const express = require('express');
const cors = require('cors');
const pool = require('./db');
require('dotenv').config();
const { Resend } = require('resend');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3001;
const resend = new Resend(process.env.RESEND_API_KEY);

app.use(cors());
app.use(express.json());

// app.use(cors({
//   origin: 'https://araha-okinawa.online',
//   methods: ['GET', 'POST', 'PUT', 'DELETE'],
//   credentials: true
// }));

// Teste de conexão
app.get('/api/test', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT NOW() AS `current_time`');
    res.json({ success: true, message: 'Conexão bem-sucedida!', data: rows });
  } catch (err) {
    console.error('Erro ao conectar ao MySQL:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Lista bolos com tamanhos e estoque
app.get('/api/cake', async (req, res) => {
  try {
    const [cakes] = await pool.query('SELECT * FROM cakes');
    const [sizes] = await pool.query('SELECT * FROM cake_sizes');

    const result = cakes.map(cake => ({
      ...cake,
      sizes: sizes.filter(s => s.cake_id === cake.id)
    }));

    res.json({ success: true, cakes: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Erro ao buscar bolos' });
  }
});

app.get('/api/timeslots', async (req, res) => {
  try {
    const [timeslots] = await pool.query('SELECT * FROM timeslots ORDER BY date,time');
    const availableDates = [...new Set(timeslots.map(t => t.date))];
    res.json({ success: true, availableDates, timeslots });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Erro ao buscar horários' });
  }
});

app.post('/api/reservar', async (req, res) => {
  const newOrder = req.body;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1️⃣ Inserir pedido
    const [orderResult] = await conn.query(
      'INSERT INTO orders (first_name,last_name,tel,email,date,pickupHour,status,message) VALUES (?,?,?,?,?,?,?,?)',
      [newOrder.first_name,newOrder.last_name,newOrder.tel,newOrder.email,newOrder.date,newOrder.pickupHour,'a',newOrder.message]
    );

    const orderId = orderResult.insertId;

    // 2️⃣ Inserir relação pedido <-> bolos e atualizar estoque
    for (const orderCake of newOrder.cakes) {
      // inserir na tabela order_cakes
      await conn.query(
        'INSERT INTO order_cakes (order_id, cake_id, size, amount, message_cake) VALUES (?,?,?,?,?)',
        [orderId, orderCake.cake_id, orderCake.size, orderCake.amount, orderCake.message_cake]
      );

      // atualizar estoque
      await conn.query(
        'UPDATE cake_sizes SET stock = GREATEST(stock - ?, 0) WHERE cake_id=? AND size=?',
        [orderCake.amount, orderCake.cake_id, orderCake.size]
      );
    }

    // 3️⃣ Gerar QR Code
    const qrCodeBuffer = await QRCode.toBuffer(String(orderId), { type:'png', width:400 });

    const qrCodeContentId = 'qrcode_order_id';
    const htmlContent = `
      <h2>🎂 注文ありがとうございます！</h2>
      <p>受付番号: <strong>${String(orderId).padStart(4,"0")}</strong></p>
      <p>お名前: ${newOrder.first_name} ${newOrder.last_name}</p>
      <p>電話番号: ${newOrder.tel}</p>
      <p>受け取り日時: ${newOrder.date} - ${newOrder.pickupHour}</p>
      <p>ご注文内容:</p>
      <ul>
        ${newOrder.cakes.map(c => `<li>${c.name} - ${c.size} - ${c.amount}個 - ${c.message_cake}</li>`).join('')}
      </ul>
      <p>受付用QRコード:</p>
      <img src="cid:${qrCodeContentId}" width="400" />
    `;

    // 4️⃣ Enviar email
    await resend.emails.send({
      from: "Pedidos <info@araha-okinawa.online>",
      to: newOrder.email,
      subject: `🎂 ご注文確認 - 受付番号 ${String(orderId).padStart(4,"0")}`,
      html: htmlContent,
      attachments: [{
        filename: 'qrcode.png',
        content: qrCodeBuffer,
        contentDisposition: 'inline',
        contentId: qrCodeContentId
      }]
    });

    await conn.commit();
    res.json({ success: true, id: orderId });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    conn.release();
  }
});

app.put('/api/reservar/:id_order', async (req, res) => {
  const { status } = req.body;
  const id_order = parseInt(req.params.id_order,10);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // pega pedido atual
    const [rows] = await conn.query('SELECT * FROM orders WHERE id_order=?', [id_order]);
    if (rows.length === 0) throw new Error('Pedido não encontrado');
    const previousStatus = rows[0].status;

    // atualizar status
    await conn.query('UPDATE orders SET status=? WHERE id_order=?', [status, id_order]);

    // se for cancelamento, devolver estoque
    if(status==='e' && previousStatus!=='e'){
      const [orderCakes] = await conn.query('SELECT * FROM order_cakes WHERE order_id=?', [id_order]);
      for(const oc of orderCakes){
        await conn.query('UPDATE cake_sizes SET stock = stock + ? WHERE cake_id=? AND size=?', [oc.amount, oc.cake_id, oc.size]);
      }
    }

    await conn.commit();
    res.json({ success: true, message:'Status atualizado', id_order });
  } catch(err){
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success:false, error: err.message });
  } finally {
    conn.release();
  }
});

app.get('/api/list', async (req, res) => {
  try {
    const search = (req.query.search || '').toString().trim().toLowerCase();
    let query = `
      SELECT 
        o.*, 
        oc.id AS order_cake_id,
        oc.cake_id,
        c.name AS cake_name,
        oc.size,
        oc.amount,
        oc.message_cake,
        cs.price AS price
      FROM orders o
      LEFT JOIN order_cakes oc ON o.id_order = oc.order_id
      LEFT JOIN cakes c ON oc.cake_id = c.id
      LEFT JOIN cake_sizes cs ON cs.cake_id = oc.cake_id AND cs.size = oc.size
    `;
    
    const params = [];

    if (search) {
      query += `
        WHERE LOWER(CONCAT(o.first_name, o.last_name)) LIKE ? 
        OR o.tel LIKE ? 
        OR o.id_order = ?
      `;
      params.push(`%${search}%`, `%${search}%`, Number(search) || 0);
    }

    query += ' ORDER BY o.id_order DESC';

    const [rows] = await pool.query(query, params);

    // 🔹 Agrupar os bolos dentro de cada pedido
    const ordersMap = new Map();

    for (const row of rows) {
      if (!ordersMap.has(row.id_order)) {
        ordersMap.set(row.id_order, {
          id_order: row.id_order,
          id_client: row.id_client,
          first_name: row.first_name,
          last_name: row.last_name,
          email: row.email,
          tel: row.tel,
          date: row.date,
          date_order: row.date_order,
          pickupHour: row.pickupHour,
          message: row.message,
          status: row.status,
          cakes: []
        });
      }

      if (row.cake_id) {
        ordersMap.get(row.id_order).cakes.push({
          id: row.order_cake_id,
          cake_id: row.cake_id,
          name: row.cake_name,
          size: row.size,
          amount: row.amount,
          message_cake: row.message_cake,
          price: row.price
        });
      }
    }

    const orders = Array.from(ordersMap.values());
    res.json({ success: true, orders });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});


app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
