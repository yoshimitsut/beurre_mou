const express = require('express');
const router = express.Router();
const pool = require('../config/db'); 

// --------------------------------------------------------------------------------
// Rota de Inserção em Lote (POST /api/timeslots/batch)
// Lida com o formulário do React (seleciona data e múltiplos horários)
// --------------------------------------------------------------------------------
router.post('/batch', async (req, res) => {
  const { dates, times } = req.body;

  // console.log('Recebendo lote:', { dates, times });

  if (!dates || !times || dates.length === 0 || times.length === 0) {
    return res.status(400).json({ success: false, error: 'Dados incompletos: Datas e horários de vagas são obrigatórios.' });
  }

  let insertedCount = 0;
  let skippedCount = 0;

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    for (const dateStr of dates) {
      // console.log(`Processando data: ${dateStr}`);
      
      // 1. PRIMEIRO verificar se o dia já existe
      const [existingDays] = await conn.query('SELECT id FROM days WHERE day_date = ?', [dateStr]);
      
      let dayId;
      if (existingDays.length > 0) {
        // Dia já existe, usar o ID existente
        dayId = existingDays[0].id;
        // console.log(`Dia ${dateStr} já existe com ID: ${dayId}`);
      } else {
        // Dia não existe, inserir novo
        const [insertResult] = await conn.query('INSERT INTO days (day_date) VALUES (?)', [dateStr]);
        dayId = insertResult.insertId;
        // console.log(`Novo dia ${dateStr} inserido com ID: ${dayId}`);
      }

      for (const timeStr of times) {
        // 2. Obter o ID do horário na tabela 'times'
        const [timeRow] = await conn.query('SELECT id FROM times WHERE time_value = ?', [timeStr]);
        
        if (timeRow.length === 0) {
            console.warn(`Horário padrão '${timeStr}' não encontrado na tabela 'times'. Inserção pulada.`);
            skippedCount++;
            continue; 
        }
        const timeId = timeRow[0].id;

        // console.log(`Time ID para ${timeStr}: ${timeId}`);

        // 3. Inserir na tabela de ligação 'day_time_slots'
        const [result] = await conn.query(
          'INSERT IGNORE INTO day_time_slots (day_id, time_id) VALUES (?, ?)',
          [dayId, timeId]
        );
        
        if (result.affectedRows > 0) {
            insertedCount++;
            // console.log(`Inserido: ${dateStr} - ${timeStr}`);
        } else {
            skippedCount++;
            // console.log(`Ignorado (duplicado): ${dateStr} - ${timeStr}`);
        }
      }
    }
    
    await conn.commit();
    // console.log(`Lote finalizado: ${insertedCount} inseridos, ${skippedCount} ignorados`);
    
    res.json({ 
      success: true, 
      message: 'Lote de horários processado com sucesso!', 
      inserted: insertedCount,
      skipped: skippedCount
    });

  } catch (err) {
    await conn.rollback();
    console.error('Erro no processamento do lote de horários:', err);
    res.status(500).json({ success: false, error: err.message, inserted: 0, skipped: 0 });
  } finally {
    conn.release();
  }
});

// --------------------------------------------------------------------------------
// Rota de Busca (GET /api/timeslots)
// Faz JOIN nas três tabelas e formata a saída para o React
// --------------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT
        dt.id,
        d.day_date AS date,
        t.time_value AS time
      FROM day_time_slots dt
      JOIN days d ON dt.day_id = d.id
      JOIN times t ON dt.time_id = t.id
      ORDER BY d.day_date, t.time_value
    `;
    const [timeslots] = await pool.query(query);

    // O formato da data já deve ser YYYY-MM-DD vindo do MySQL/MariaDB
    res.json({ success: true, timeslots });

  } catch (err) {
    console.error('Erro ao buscar horários normalizados:', err);
    res.status(500).json({ success: false, error: 'Erro ao buscar horários' });
  }
});

router.get('/times', async (req, res) => {
  try {
    const [times] = await pool.query('SELECT * FROM times ORDER BY time_value');
    res.json({ success: true, times });
  } catch (err) {
    console.error('Erro ao buscar horários:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/times', async (req, res) => {
  const { time_value } = req.body;
  
  if (!time_value) {
    return res.status(400).json({ success: false, error: 'Horário é obrigatório' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO times (time_value) VALUES (?)', 
      [time_value]
    );
    res.json({ 
      success: true, 
      id: result.insertId,
      message: 'Horário adicionado com sucesso!'
    });
  } catch (err) {
    console.error('Erro ao adicionar horário:', err);
    
    // Verifica se é erro ede duplicata
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ 
        success: false, 
        error: 'Este horário já existe no sistema.' 
      });
    }
    
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/times/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  
  if (isNaN(id)) {
    return res.status(400).json({ success: false, error: 'ID inválido.' });
  }

  const conn = await pool.getConnection();
  
  try {
    await conn.beginTransaction();

    // Verifica se o horário está sendo usado em day_time_slots
    const [usageCheck] = await conn.query(
      'SELECT COUNT(*) as usage_count FROM day_time_slots WHERE time_id = ?',
      [id]
    );

    if (usageCheck[0].usage_count > 0) {
      await conn.rollback();
      return res.status(400).json({ 
        success: false, 
        error: 'Não é possível excluir este horário pois ele está vinculado a dias existentes.' 
      });
    }

    // Exclui o horário
    const [result] = await conn.query('DELETE FROM times WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, error: 'Horário não encontrado.' });
    }
    
    await conn.commit();
    res.json({ 
      success: true, 
      message: 'Horário excluído com sucesso!' 
    });
  } catch (err) {
    await conn.rollback();
    console.error('Erro ao excluir horário:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    conn.release();
  }
});

router.get('/days', async (req, res) => {
  try {
    const [days] = await pool.query('SELECT * FROM days ORDER BY day_date');
    res.json({ success: true, days });
  } catch (err) {
    console.error('Erro ao buscar dias:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --------------------------------------------------------------------------------
// Rota de Exclusão (DELETE /api/timeslots/:id)
// Exclui o registro da tabela de ligação 'day_time_slots'
// --------------------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  
  if (isNaN(id)) {
    return res.status(400).json({ success: false, error: 'ID inválido.' });
  }

  try {
    // A exclusão ocorre apenas na tabela de ligação, preservando os registros em 'days' e 'times'
    const [result] = await pool.query('DELETE FROM day_time_slots WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Horário de slot não encontrado.' });
    }
    
    res.json({ 
      success: true, 
      message: 'Slot de horário excluído com sucesso!' 
    });
  } catch (err) {
    console.error('Erro ao excluir slot:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
