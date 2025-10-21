const express = require('express');
const cors = require('cors');
const pool = require('./db');
require('dotenv').config();
const { Resend } = require('resend');
const QRCode = require('qrcode');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3001;

// const resend = new Resend(process.env.RESEND_API_KEY);
const resend = new Resend("re_c8hnBVtD_JX19Sk4HsVZ7kayHwWFG16ZG");

app.use(cors());
app.use(express.json());

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
    const [timeslots] = await pool.query('SELECT * FROM timeslots ORDER BY date, time');

    // Converte as datas para string YYYY-MM-DD
    const formattedTimeslots = timeslots.map(t => ({
      ...t,
      date: t.date ? t.date.toISOString().split('T')[0] : null
    }));

    const availableDates = [...new Set(formattedTimeslots.map(t => t.date))];

    res.json({ success: true, availableDates, timeslots: formattedTimeslots });
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
      [newOrder.first_name,newOrder.last_name,newOrder.tel,newOrder.email,newOrder.date,newOrder.pickupHour,newOrder.status,newOrder.message]
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
    
    if (newOrder.message === ''){
      newOrder.message = 'なし'
    }
  
    const htmlContent = `
    <h2>🎂 注文ありがとうございます！</h2>
    <p>お名前: ${newOrder.first_name} ${newOrder.last_name}</p>
    <p>受付番号: <strong>${String(orderId).padStart(4,"0")}</strong></p>
    <p>電話番号: ${newOrder.tel}</p>
    <p>受け取り日時: ${newOrder.date} / ${newOrder.pickupHour}</p>
    <p>メッセージ: ${newOrder.message}</p>

    <p>ご注文商品:</p>
    
    ${newOrder.cakes.map(cake => `
      <table style="width: 400px; margin-bottom: 20px; border-collapse: collapse; background: #f9f9f9; border-radius: 8px; overflow: hidden;">
        <tr>
          <td style="width: 120px; padding: 15px; vertical-align: top;">
            <img src="https://yoyaku.beurre-mou.com/image/${cake.name.toLowerCase().replace(/\s+/g, '-')}.jpg" 
              alt="${cake.name}" 
              width="100" 
              style="border-radius: 6px; border: 1px solid #ddd;"
              onerror="this.style.display='none'">
          </td>
          
          <td style="padding: 15px; vertical-align: top;">
            <h3 style="margin: 0 0 10px 0;">${cake.name}</h3>
            ${cake.size ? `<p style="margin: 5px 0;"><strong>サイズ:</strong> ${cake.size}</p>` : ''}
            <p style="margin: 5px 0;"><strong>個数:</strong> ${cake.amount}個</p>
            <p style="margin: 5px 0;"><strong>価格:</strong> ¥${(cake.price*1.08).toLocaleString("ja-JP")}</p>
            ${cake.message_cake ? `<p style="margin: 5px 0;"><strong>メッセージプレート:</strong> ${cake.message_cake || 'なし'}</p>` : ''}
            <hr/>
            <strong>小計 ${((cake.price*1.08)*cake.amount).toLocaleString("ja-JP")}</strong>
            </td>
        </tr>
      </table>
    `).join('')}

    <div style="background: #000; width: 400px; text-align: center;">
      <p style="font-size: 16px;">  <strong>合計金額
        ¥${Math.trunc(newOrder.cakes.reduce((total, cake) => total + ((cake.price * 1.08) * cake.amount), 0)).toLocaleString("ja-JP")}
        </strong><span style="font-size: 14px; font-weight: small;">(税込)</span>
      </p>
    </div>

    <p>受付用QRコード:</p>
    <p style='color: red'>※受取当日にスタッフに提示していただくとスムーズです。</p>
    <img src="cid:${qrCodeContentId}" width="400" />
    <p>上記の内容に相違がございましたら、お手数をお掛けしますが、</p>
    <p>ご連絡をお願いいたします。</p>
    <p>パティスリーブール・ムー（open 11:00 - 19:00）</p>
    <p>TEL: 080-9854-2849</a></p>
    <p>宜しくお願いいたいます。</p>
    `;
    
    await resend.emails.send({
      from: "パティスリーブール・ムー <order@yoyaku.beurre-mou.com>",
      to: [newOrder.email, "shimitsutanaka@gmail.com"],
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

// editarpedido - verificar código e fazer testes!!!!
app.put('/api/orders/:id_order', async (req, res) => {
  const {
    first_name,
    last_name,
    email,
    tel,
    date,
    pickupHour,
    message,
    cakes,
    status
  } = req.body;
  
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: "shimitsutanaka@gmail.com",
        pass: "vmiepzoxltefekcr"
    }
  });

  const id_order = parseInt(req.params.id_order, 10);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1. Verificar se o pedido existe e pegar os cakes antigos
    const [existingOrder] = await conn.query('SELECT * FROM orders WHERE id_order = ?', [id_order]);
    if (existingOrder.length === 0) {
      throw new Error('Pedido não encontrado');
    }

    const previousStatus = existingOrder[0].status;

    // 2. Pegar os cakes antigos do pedido
    const [oldCakes] = await conn.query('SELECT * FROM order_cakes WHERE order_id = ?', [id_order]);

    // 3. Atualizar dados principais do pedido
    await conn.query(
      `UPDATE orders 
       SET first_name = ?, last_name = ?, email = ?, tel = ?, 
           date = ?, pickupHour = ?, message = ?, status = ?
       WHERE id_order = ?`,
      [first_name, last_name, email, tel, date, pickupHour, message, status, id_order]
    );

    // 4. LÓGICA DE ESTOQUE - Comparar cakes antigos e novos
    if (previousStatus !== 'e' && status !== 'e') {
      // Apenas ajustar estoque se não for cancelamento
      await adjustStock(conn, oldCakes, cakes);
    }

    // 5. Remover cakes antigos e adicionar novos
    await conn.query('DELETE FROM order_cakes WHERE order_id = ?', [id_order]);

    // 6. Inserir novos cakes
    for (const cake of cakes) {
      await conn.query(
        `INSERT INTO order_cakes (order_id, cake_id, amount, size, message_cake)
         VALUES (?, ?, ?, ?, ?)`,
        [id_order, cake.cake_id, cake.amount, cake.size, cake.message_cake || '']
      );
    }

    // 7. Lógica de estoque para cancelamento/reativação
    if (status === 'e' && previousStatus !== 'e') {
      // Cancelamento - devolver estoque
      for (const cake of cakes) {
        await conn.query(
          'UPDATE cake_sizes SET stock = stock + ? WHERE cake_id = ? AND size = ?',
          [cake.amount, cake.cake_id, cake.size]
        );
      }
    } else if (previousStatus === 'e' && status !== 'e') {
      // Reativação - remover estoque novamente
      for (const cake of cakes) {
        await conn.query(
          'UPDATE cake_sizes SET stock = stock - ? WHERE cake_id = ? AND size = ?',
          [cake.amount, cake.cake_id, cake.size]
        );
      }
    }

    // Função para ajustar estoque baseado nas diferenças
    async function adjustStock(conn, oldCakes, newCakes) {
      // Criar mapas para facilitar a comparação
      const oldCakeMap = new Map();
      const newCakeMap = new Map();

      // Preencher mapa de cakes antigos
      oldCakes.forEach(cake => {
        const key = `${cake.cake_id}-${cake.size}`;
        oldCakeMap.set(key, cake.amount);
      });

      // Preencher mapa de cakes novos
      newCakes.forEach(cake => {
        const key = `${cake.cake_id}-${cake.size}`;
        newCakeMap.set(key, cake.amount);
      });

      // Processar diferenças
      const allKeys = new Set([...oldCakeMap.keys(), ...newCakeMap.keys()]);

      for (const key of allKeys) {
        const [cakeId, size] = key.split('-');
        const oldAmount = oldCakeMap.get(key) || 0;
        const newAmount = newCakeMap.get(key) || 0;
        const difference = newAmount - oldAmount;

        if (difference !== 0) {
          if (difference > 0) {
            // Aumentou a quantidade - diminuir estoque
            await conn.query(
              'UPDATE cake_sizes SET stock = stock - ? WHERE cake_id = ? AND size = ?',
              [difference, cakeId, size]
            );
          } else {
            // Diminuiu a quantidade - aumentar estoque
            await conn.query(
              'UPDATE cake_sizes SET stock = stock + ? WHERE cake_id = ? AND size = ?',
              [Math.abs(difference), cakeId, size]
            );
          }
        }
      }

      // Processar cakes que foram completamente removidos
      for (const [key, oldAmount] of oldCakeMap) {
        if (!newCakeMap.has(key)) {
          const [cakeId, size] = key.split('-');
          // Devolver todo o estoque do cake removido
          await conn.query(
            'UPDATE cake_sizes SET stock = stock + ? WHERE cake_id = ? AND size = ?',
            [oldAmount, cakeId, size]
          );
        }
      }

      // Processar cakes que foram completamente adicionados
      for (const [key, newAmount] of newCakeMap) {
        if (!oldCakeMap.has(key)) {
          const [cakeId, size] = key.split('-');
          // Remover estoque do novo cake adicionado
          await conn.query(
            'UPDATE cake_sizes SET stock = stock - ? WHERE cake_id = ? AND size = ?',
            [newAmount, cakeId, size]
          );
        }
      }
    }

    // 8. Gerar QR Code e enviar email
    const qrCodeBuffer = await QRCode.toBuffer(String(id_order).padStart(4, "0"), { type: 'png', width: 400 });
    const qrCodeContentId = 'qrcode_order_id';

    const cakeListHtml = cakes.map(cake => `
      <table style="width: 400px; margin-bottom: 20px; border-collapse: collapse; background: #f9f9f9; border-radius: 8px; overflow: hidden;">
        <tr>
          <td style="width: 120px; padding: 15px; vertical-align: top;">
            <img src="https://yoyaku.beurre-mou.com/image/${cake.name.toLowerCase().replace(/\s+/g, '-')}.jpg" 
              alt="${cake.name}" 
              width="100" 
              style="border-radius: 6px; border: 1px solid #ddd;"
              onerror="this.style.display='none'">
          </td>
          
          <td style="padding: 15px; vertical-align: top;">
            <h3 style="margin: 0 0 10px 0;">${cake.name}</h3>
            <p style="margin: 5px 0;"><strong>サイズ:</strong> ${cake.size}</p>
            <p style="margin: 5px 0;"><strong>個数:</strong> ${cake.amount}個</p>
            <p style="margin: 5px 0;"><strong>価格:</strong> ¥${cake.price.toLocaleString()}</p>
            ${cake.message_cake ? `<p style="margin: 5px 0;"><strong>メッセージプレート:</strong> ${cake.message_cake}</p>` : ''}
            <hr/>
            <strong>小計: ¥${((cake.price * cake.amount)).toLocaleString("ja-JP")}</strong>
          </td>
        </tr>
      </table>
    `).join('');

    // Calcular total geral
    const totalGeral = cakes.reduce((total, cake) => total + (cake.price * cake.amount), 0);
    const totalComTaxa = totalGeral * 1.08;

    const mailOptions = {
        from: '"パティスリーブール・ムー" <shimitsutanaka@gmail.com>', 
        to: email, 
        subject: `🎂 ご注文内容変更のお知らせ - 受付番号 ${String(id_order).padStart(4, "0")}`,
        html: `
          <div style="border: 1px solid #ddd; padding: 20px; max-width: 400px; margin: 0 auto; font-family: Arial, sans-serif;">
            <h2 style="text-align: center; color: #333;">以下の内容に変更いたしました</h2>
            <p><strong>お名前：</strong> ${first_name} ${last_name}様</p>
            <p><strong>受付番号：</strong> ${String(id_order).padStart(4, "0")}</p>
            <p><strong>受取日時：</strong> ${date} / ${pickupHour}</p>
            <p><strong>メッセージ：</strong> ${message || 'なし'}</p>
            
            <h3 style="border-bottom: 2px solid #333; padding-bottom: 5px;">ご注文商品</h3>
            ${cakeListHtml}

            <!-- Total geral -->
            <div style="max-width: 400px; background: #ddd; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <h3 style="margin: 0; color: #000;">合計金額</h3>
              <p style="font-size: 24px; font-weight: bold; margin: 10px 0 0 0;">
                ¥${totalComTaxa.toLocaleString("ja-JP")}
                <span style="font-size: 14px; font-weight: normal;">(税込)</span>
              </p>
            </div>

            <div style="text-align: center; margin: 20px 0;">
              <p><strong>受付用QRコード</strong></p>
              <img src="cid:${qrCodeContentId}" width="300" style="display: block; margin: 0 auto;" />
            </div>

            <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin-top: 20px;">
              <p style="margin: 0; font-size: 14px;">上記の内容に相違がございましたら、お手数をお掛けしますが、</p>
              <p style="margin: 5px 0 0 0; font-size: 14px;">ご連絡をお願いいたします。</p>
              <p style="margin: 10px 0 0 0;"><strong>パティスリーブール・ムー</strong></p>
              <p style="margin: 5px 0;">open 11:00 - 19:00</p>
              <p style="margin: 5px 0;">TEL: <a href="tel:080-9854-2849" style="color: #007bff; text-decoration: none;">080-9854-2849</a></p>
            </div>
            
            <p style="text-align: center; margin-top: 20px; font-style: italic;">宜しくお願いいたします。</p>
          </div>
        `,
        attachments: [{
          filename: 'qrcode.png',
          content: qrCodeBuffer,
          contentDisposition: 'inline',
          contentId: qrCodeContentId,
          contentType: 'image/png', 
          cid: qrCodeContentId
        }]
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log("更新メールを送信しました:", info.messageId);
    } catch (emailError) {
        console.error("更新メールの送信中にエラーが発生しました:", emailError);
    }

    await conn.commit();
    res.json({ success: true, message: 'Pedido atualizado com sucesso', id_order });
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

    // se for voltar o pedido, tirar qtdade do estoque
    if(status!=='e' && previousStatus==='e'){
      const [orderCakes] = await conn.query('SELECT * FROM order_cakes WHERE order_id=?', [id_order]);
      for(const oc of orderCakes){
        await conn.query('UPDATE cake_sizes SET stock = stock - ? WHERE cake_id=? AND size=?', [oc.amount, oc.cake_id, oc.size]);
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
        cs.price AS price,
        cs.stock AS stock
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
          date: row.date ? row.date.toISOString().split('T')[0] : null,
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
          price: row.price,
          stock: row.stock
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
