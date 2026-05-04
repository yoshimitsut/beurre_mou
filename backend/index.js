const express = require('express');
const cors = require('cors');
const pool = require('./db');
require('dotenv').config();
const { Resend } = require('resend');
const QRCode = require('qrcode');
const nodemailer = require('nodemailer');

const timeslotRoutes = require('./routers/timeslotRoutes');

const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// const resend = new Resend(process.env.RESEND_API_KEY);
const resend = new Resend("re_hzxu4eZx_9DppwUc2WC5bgcHWXPucpjR3");

const cakeRoutes = require('./routers/cakeRoutes');

app.use(cors());
app.use(express.json());

app.use('/image', express.static(path.resolve(process.cwd(), 'uploads')));

app.use('/api/cake', cakeRoutes);

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
        'INSERT INTO order_cakes (order_id, cake_id, size, amount, message_cake, fruit_option) VALUES (?,?,?,?,?,?)',
        [orderId, orderCake.cake_id, orderCake.size, orderCake.amount, orderCake.message_cake, orderCake.fruit_option]
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
      newOrder.message = '無し'
    }

    const htmlContent = `
    <div style="border: 1px solid #ddd; padding: 20px; max-width: 400px; margin: 0 auto; font-family: Arial, sans-serif;">  
    <h2>🎂 注文ありがとうございます！</h2>
    <p>お名前: ${newOrder.first_name} ${newOrder.last_name}</p>
    <p>受付番号: <strong>${String(orderId).padStart(4,"0")}</strong></p>
    <p>電話番号: ${newOrder.tel}</p>
    <p>受け取り日時: ${newOrder.date} / ${newOrder.pickupHour}</p>
    <p>メッセージ: ${newOrder.message}</p>

    <h3 style="border-bottom: 2px solid #333; padding-bottom: 5px;">ご注文商品</h3>
            
    ${newOrder.cakes.map(cake => { 
      const fruitPrice = cake.fruit_option === '有り' ? 648 : 0;
      const cakeTotalPrice = (cake.price + fruitPrice) * cake.amount;

      return `
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
              <p style="margin: 5px 0;"><strong>価格:</strong> ¥${Math.trunc(cake.price).toLocaleString("ja-JP")}</p>
              ${cake.message_cake ? `<p style="margin: 5px 0;"><strong>メッセージプレート:</strong> ${cake.message_cake || '無し'}</p>` : ''}
              <p style="margin: 5px 0;"><strong>フルーツ盛り:</strong> ${cake.fruit_option === '有り' ? '有り ＋648円' : '無し'}
              <hr/>
              <strong>小計 ${(cakeTotalPrice).toLocaleString("ja-JP")}</strong>
              </td>
          </tr>
        </table>
      
    `}).join('')}

      <div style="max-width: 400px; background: #ddd; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
        <h3 style="margin: 0; color: #000;">合計金額</h3>
        <p style="font-size: 24px; font-weight: bold; margin: 10px 0 0 0;">
          ¥${Math.trunc(newOrder.cakes.reduce((total, cake) => {
            const fruitPrice = cake.fruit_option === '有り' ? 648 : 0;
            return total + ((cake.price + fruitPrice) * cake.amount)
            }, 0)).toLocaleString("ja-JP")
          }
          <span style="font-size: 14px; font-weight: normal;">(税込)</span>
        </p>
      </div>
    
      <div style="text-align: center; margin: 20px 0;">
        <p><strong>受付用QRコード</strong></p>
        <p><strong style="color: red;">受け取り時にご提示ください。</strong></p>
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
    `;
    
    await resend.emails.send({
      from: "パティスリーブール・ムー <order@yoyaku.beurre-mou.com>",
      to: [newOrder.email, "beurre.mou.yoyaku@gmail.com"],
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
  
  // console.log("🧁 Recebido do frontend:", req.body);
  // return
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: "beurre.mou.yoyaku@gmail.com",
        // user: "shimitsutanaka@gmail.com",
        pass: "fqqjpmcjleidbzko"
        // pass: "vmiepzoxltefekcr"
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
    // if (previousStatus !== 'e' && status !== 'e') {
      // Apenas ajustar estoque se não for cancelamento
      // await adjustStock(conn, oldCakes, cakes);
    // }

    // 5. Remover cakes antigos e adicionar novos
    await conn.query('DELETE FROM order_cakes WHERE order_id = ?', [id_order]);

    // 6. Inserir novos cakes
    for (const cake of cakes) {
      await conn.query(
        `INSERT INTO order_cakes (order_id, cake_id, amount, size, message_cake, fruit_option)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [id_order, cake.cake_id, cake.amount, cake.size, cake.message_cake || '', cake.fruit_option]
      );
    }

    // 7. Lógica de estoque para cancelamento/reativação
    if (status === 'e' && previousStatus !== 'e') {
      // Cancelamento - devolver estoque
      for (const cake of cakes) {
        console.log("7 - CANCELAMENTO - Devolvendo estoque: ", cake.amount, " - ", cake.cake_id, " - ", cake.size);
        await conn.query(
          'UPDATE cake_sizes SET stock = stock + ? WHERE cake_id = ? AND size = ?',
          [cake.amount, cake.cake_id, cake.size]
        );
      }
    } else if (previousStatus === 'e' && status !== 'e') {
      // Reativação - remover estoque novamente
      for (const cake of cakes) {
        console.log("7 - REATIVAÇÃO - Removendo estoque: ", cake.amount, " - ", cake.cake_id, " - ", cake.size);
        await conn.query(
          'UPDATE cake_sizes SET stock = stock - ? WHERE cake_id = ? AND size = ?',
          [cake.amount, cake.cake_id, cake.size]
        );
      }
    }

    // Função para ajustar estoque baseado nas diferenças
    // async function adjustStock(conn, oldCakes, newCakes) {
    //   // console.log("=== INICIANDO AJUSTE DE ESTOQUE ===");
      
    //   // Criar mapas para facilitar a comparação
    //   const oldCakeMap = new Map();
    //   const newCakeMap = new Map();

    //   // Preencher mapa de cakes antigos
    //   oldCakes.forEach(cake => {
    //     const key = `${cake.cake_id}-${cake.size}`;
    //     // console.log(`PEDIDO ANTIGO: ${key} - Quantidade: ${cake.amount}`);
    //     oldCakeMap.set(key, cake.amount);
    //   });

    //   // Preencher mapa de cakes novos
    //   newCakes.forEach(cake => {
    //     const key = `${cake.cake_id}-${cake.size}`;
    //     // console.log(`PEDIDO NOVO: ${key} - Quantidade: ${cake.amount}`);
    //     newCakeMap.set(key, cake.amount);
    //   });

    //   // console.log("=== PROCESSANDO DIFERENÇAS ===");

    //   // 1. PRIMEIRO: Processar cakes que foram COMPLETAMENTE REMOVIDOS
    //   for (const [key, oldAmount] of oldCakeMap) {
    //     if (!newCakeMap.has(key)) {
    //       const [cakeId, size] = key.split('-');
    //       // console.log(`🔵 BOLO REMOVIDO: ${key} - Devolvendo estoque: ${oldAmount}`);
          
    //       // Devolver todo o estoque do cake removido
    //       await conn.query(
    //         'UPDATE cake_sizes SET stock = stock + ? WHERE cake_id = ? AND size = ?',
    //         [oldAmount, cakeId, size]
    //       );
    //     }
    //   }

    //   // 2. SEGUNDO: Processar cakes que foram COMPLETAMENTE ADICIONADOS
    //   for (const [key, newAmount] of newCakeMap) {
    //     if (!oldCakeMap.has(key)) {
    //       const [cakeId, size] = key.split('-');
    //       // console.log(`🟢 NOVO BOLO ADICIONADO: ${key} - Removendo estoque: ${newAmount}`);
          
    //       // Remover estoque do novo cake adicionado
    //       await conn.query(
    //         'UPDATE cake_sizes SET stock = stock - ? WHERE cake_id = ? AND size = ?',
    //         [newAmount, cakeId, size]
    //       );
    //     }
    //   }

    //   // 3. TERCEIRO: Processar cakes que foram MODIFICADOS (existem em ambos)
    //   const allKeys = new Set([...oldCakeMap.keys(), ...newCakeMap.keys()]);

    //   for (const key of allKeys) {
    //     const [cakeId, size] = key.split('-');
    //     const oldAmount = oldCakeMap.get(key) || 0;
    //     const newAmount = newCakeMap.get(key) || 0;
        
    //     // Só processa se existir em AMBOS os mapas
    //     if (oldCakeMap.has(key) && newCakeMap.has(key)) {
    //       const difference = newAmount - oldAmount;

    //       if (difference !== 0) {
    //         if (difference > 0) {
    //           // Aumentou a quantidade - diminuir estoque
    //           // console.log(`📈 QUANTIDADE AUMENTOU: ${key} - Diferença: +${difference} (Antigo: ${oldAmount} → Novo: ${newAmount})`);
    //           await conn.query(
    //             'UPDATE cake_sizes SET stock = stock - ? WHERE cake_id = ? AND size = ?',
    //             [difference, cakeId, size]
    //           );
    //         } else {
    //           // Diminuiu a quantidade - aumentar estoque
    //           // console.log(`📉 QUANTIDADE DIMINUIU: ${key} - Diferença: ${difference} (Antigo: ${oldAmount} → Novo: ${newAmount})`);
    //           await conn.query(
    //             'UPDATE cake_sizes SET stock = stock + ? WHERE cake_id = ? AND size = ?',
    //             [Math.abs(difference), cakeId, size]
    //           );
    //         }
    //       } else {
    //         // console.log(`⚖️ QUANTIDADE IGUAL: ${key} - Quantidade: ${oldAmount}`);
    //       }
    //     }
    //   }

    //   // console.log("=== AJUSTE DE ESTOQUE CONCLUÍDO ===");
    // }

    // 8. Gerar QR Code e enviar email
    const qrCodeBuffer = await QRCode.toBuffer(String(id_order).padStart(4, "0"), { type: 'png', width: 400 });
    const qrCodeContentId = 'qrcode_order_id';

    const cakeListHtml = cakes.map(cake => {
      const fruitPrice = cake.fruit_option === '有り' ? 648 : 0;
      const cakeTotalPrice = (cake.price + fruitPrice) * cake.amount;
 
      return `
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
              <p style="margin: 5px 0;"><strong>価格:</strong> ¥${Math.trunc(cake.price).toLocaleString()}</p>
              <p style="margin: 5px 0;"><strong>フルーツ盛り:</strong> ${cake.fruit_option === '有り' ? '有り ＋648円' : '無し'}
              ${cake.message_cake ? `<p style="margin: 5px 0;"><strong>メッセージプレート:</strong> ${cake.message_cake}</p>` : ''}
              <hr/>
              <strong>小計: ¥${Math.trunc(cakeTotalPrice).toLocaleString("ja-JP")}</strong>
            </td>
          </tr>
        </table>
      `}).join('');

    // Calcular total geral
    const totalGeral = cakes.reduce((total, cake) => {
      const fruitPrice = cake.fruit_option === '有り' ? 648 : 0;
      return total + ((cake.price + fruitPrice) * cake.amount);
    }, 0);

    const mailOptions = {
        from: '"パティスリーブール・ムー" <beurre.mou.yoyaku@gmail.com>', 
        to: [email, "beurre.mou.yoyaku@gmail.com"],
        subject: `🎂 ご注文内容変更のお知らせ - 受付番号 ${String(id_order).padStart(4, "0")}`,
        html: `
          <div style="border: 1px solid #ddd; padding: 20px; max-width: 400px; margin: 0 auto; font-family: Arial, sans-serif;">
            <h2 style="text-align: center; color: #333;">以下の内容に変更いたしました</h2>
            <p><strong>お名前：</strong> ${first_name} ${last_name}様</p>
            <p><strong>受付番号：</strong> ${String(id_order).padStart(4, "0")}</p>
            <p><strong>受取日時：</strong> ${date} / ${pickupHour}</p>
            <p><strong>メッセージ：</strong> ${message || '無し'}</p>
            
            <h3 style="border-bottom: 2px solid #333; padding-bottom: 5px;">ご注文商品</h3>
            ${cakeListHtml}

            <!-- Total geral -->
            <div style="max-width: 400px; background: #ddd; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <h3 style="margin: 0; color: #000;">合計金額</h3>
              <p style="font-size: 24px; font-weight: bold; margin: 10px 0 0 0;">
                ¥${Math.trunc(totalGeral).toLocaleString("ja-JP")}
                <span style="font-size: 14px; font-weight: normal;">(税込)</span>
              </p>
            </div>

            <div style="text-align: center; margin: 20px 0;">
              <p><strong>受付用QRコード</strong></p>
              <p><strong style="color: red;">受け取り時にご提示ください。</strong></p>
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

  // Configurar o transporter do nodemailer
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: "beurre.mou.yoyaku@gmail.com",
      // user: "shimitsutanaka@gmail.com",
        pass: "fqqjpmcjleidbzko"
        // pass: "vmiepzoxltefekcr"
    }
  });

  // Função para formatar a data no formato japonês
  const formatDateJP = (dateString) => {
    if (!dateString) return '';
    
    // Se já for uma string no formato YYYY-MM-DD
    if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateString.split('-');
      return `${year}年${month}月${day}日`;
    }
    
    // Se for um objeto Date ou string com timestamp
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}年${month}月${day}日`;
  };

  try {
    await conn.beginTransaction();

    // pega pedido atual
    const [rows] = await conn.query('SELECT * FROM orders WHERE id_order=?', [id_order]);
    if (rows.length === 0) throw new Error('Pedido não encontrado');
    
    const order = rows[0];
    const previousStatus = order.status;

    // atualizar status
    await conn.query('UPDATE orders SET status=? WHERE id_order=?', [status, id_order]);

    // se for cancelamento, devolver estoque
    if(status==='e' && previousStatus!=='e'){
      const [orderCakes] = await conn.query('SELECT * FROM order_cakes WHERE order_id=?', [id_order]);
      for(const oc of orderCakes){
        await conn.query('UPDATE cake_sizes SET stock = stock + ? WHERE cake_id=? AND size=?', [oc.amount, oc.cake_id, oc.size]);
      }

      // 📧 ENVIAR EMAIL DE CANCELAMENTO
      try {
        // Buscar detalhes dos bolos do pedido
        const [cakesDetails] = await conn.query(`
          SELECT oc.*, c.name 
          FROM order_cakes oc 
          JOIN cakes c ON oc.cake_id = c.id 
          WHERE oc.order_id = ?
        `, [id_order]);

        const cakeListHtml = cakesDetails.map(cake => `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${cake.name}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${cake.size}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${cake.amount}個</td>
          </tr>
        `).join('');

        // Formatar a data corretamente
        const formattedDate = formatDateJP(order.date);

        const mailOptions = {
          from: '"パティスリーブール・ムー" <beurre.mou.yoyaku@gmail.com>',
          to: [order.email, "beurre.mou.yoyaku@gmail.com"],
          subject: `ご注文のキャンセル完了 - 受付番号 ${String(id_order).padStart(4, "0")}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0;">
              <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: #d32f2f; margin-bottom: 10px;">注文がキャンセルされました</h2>
                <p style="color: #666;">以下の注文がキャンセル処理されました</p>
              </div>

              <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 10px 0; color: #333;">注文詳細</h3>
                <p><strong>受付番号：</strong> ${String(id_order).padStart(4, "0")}</p>
                <p><strong>お名前：</strong> ${order.first_name} ${order.last_name}様</p>
                <p><strong>受取予定日：</strong> ${formattedDate}</p>
                <p><strong>受取時間：</strong> ${order.pickupHour}</p>
              </div>

              <div style="margin-bottom: 20px;">
                <h3 style="color: #333; margin-bottom: 10px;">キャンセルされた商品</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <thead>
                    <tr style="background: #f5f5f5;">
                      <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">商品名</th>
                      <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">サイズ</th>
                      <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">数量</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${cakeListHtml}
                  </tbody>
                </table>
              </div>

              <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border: 1px solid #ffeaa7; margin-bottom: 20px;">
                <h4 style="color: #856404; margin: 0 0 10px 0;">📝 キャンセルについて</h4>
                <p style="color: #856404; margin: 0; font-size: 14px;">
                  ご注文のキャンセルが完了しました。<br>
                  ご不明な点がございましたら、下記までご連絡ください。
                </p>
              </div>

              <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">
                  パティスリーブール・ムー<br>
                  OPEN 11:00 - 19:00<br>
                  TEL: <a href="tel:080-9854-2849" style="color: #007bff;">080-9854-2849</a>
                </p>
                <p style="margin: 0; font-size: 12px; color: #999;">
                  このメールは自動送信されています
                </p>
              </div>
            </div>
          `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("📧 Email de cancelamento enviado:", info.messageId);
        
      } catch (emailError) {
        console.error("❌ Erro ao enviar email de cancelamento:", emailError);
      }
    }
    
    // se for voltar o pedido, tirar qtdade do estoque
    if(status!=='e' && previousStatus==='e'){
      const [orderCakes] = await conn.query('SELECT * FROM order_cakes WHERE order_id=?', [id_order]);
      for(const oc of orderCakes){
        await conn.query('UPDATE cake_sizes SET stock = stock - ? WHERE cake_id=? AND size=?', [oc.amount, oc.cake_id, oc.size]);
      }

      // 📧 OPÇÃO: Também pode enviar email de reativação se quiser
      // try {
      //   const formattedDate = formatDateJP(order.date);
        
      //   const mailOptions = {
      //     from: '"パティスリーブール・ムー" <shimitsutanaka@gmail.com>',
      //     to: order.email,
      //     subject: `✅ ご注文の再開 - 受付番号 ${String(id_order).padStart(4, "0")}`,
      //     html: `
      //       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      //         <h2 style="color: #28a745; text-align: center;">✅ 注文が再開されました</h2>
      //         <p>${order.first_name} ${order.last_name}様</p>
      //         <p>受付番号 <strong>${String(id_order).padStart(4, "0")}</strong> の注文が再開されました。</p>
      //         <p><strong>受取予定日：</strong> ${formattedDate}</p>
      //         <p><strong>受取時間：</strong> ${order.pickupHour}</p>
      //         <p>引き続きよろしくお願いいたします。</p>
      //       </div>
      //     `
      //   };
        
      //   const info = await transporter.sendMail(mailOptions);
      //   console.log("📧 Email de reativação enviado:", info.messageId);
      // } catch (emailError) {
      //   console.error("❌ Erro ao enviar email de reativação:", emailError);
      // }
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
        o.created_at as date_order,
        oc.id AS order_cake_id,
        oc.cake_id,
        c.name AS cake_name,
        oc.size,
        oc.amount,
        oc.message_cake,
        oc.fruit_option,
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
          fruit_option: row.fruit_option,
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


app.use('/api/timeslots', timeslotRoutes);

app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
