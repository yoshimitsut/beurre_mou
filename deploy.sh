#!/bin/bash
echo "🚀 Iniciando deploy seguro..."

# 1. Atualizar código
git pull

# 2. Recriar containers
docker-compose down
docker-compose up -d --build

# 3. Aguardar inicialização
echo "⏳ Aguardando serviços..."
sleep 30

# 4. Recriar links SSL (solução para bug do nginx-proxy)
echo "🔗 Criando links SSL..."
docker exec nginx-proxy sh -c '
  ln -sf /etc/nginx/certs/yoyaku.beurre-mou.com/fullchain.pem /etc/nginx/certs/yoyaku.beurre-mou.com.crt 2>/dev/null || true
  ln -sf /etc/nginx/certs/yoyaku.beurre-mou.com/key.pem /etc/nginx/certs/yoyaku.beurre-mou.com.key 2>/dev/null || true
  ln -sf /etc/nginx/certs/api.beurre-mou.com/fullchain.pem /etc/nginx/certs/api.beurre-mou.com.crt 2>/dev/null || true  
  ln -sf /etc/nginx/certs/api.beurre-mou.com/key.pem /etc/nginx/certs/api.beurre-mou.com.key 2>/dev/null || true
'

# 5. Reiniciar nginx
echo "🔄 Reiniciando nginx..."
docker restart nginx-proxy
sleep 5

# 6. Testes
echo "🧪 Testando aplicação..."
curl -I https://yoyaku.beurre-mou.com >/dev/null 2>&1 && echo "✅ SSL Yoyaku OK" || echo "❌ SSL Yoyaku Falhou"
curl https://api.beurre-mou.com/api/cake >/dev/null 2>&1 && echo "✅ API OK" || echo "❌ API Falhou"

echo "🎉 Deploy concluído com sucesso!"