#!/bin/bash

# Quick deploy script for Vonage WebSocket Connector to Railway

echo "🚀 Deploying Vonage WebSocket Connector to Railway"
echo ""

# Create vonage-connector directory
mkdir -p vonage-connector
cd vonage-connector

# Clone the connector
echo "📦 Cloning connector..."
git clone https://github.com/nexmo-se/elevenlabs-agent-ws-connector.git .

# Create Dockerfile
echo "📝 Creating Dockerfile..."
cat > Dockerfile << 'EOF'
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 6000
CMD ["node", "elevenlabs-agent-ws-connector.cjs"]
EOF

# Create .railwayignore
echo "📝 Creating .railwayignore..."
cat > .railwayignore << 'EOF'
node_modules
.env
.git
EOF

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Install Railway CLI: npm i -g @railway/cli"
echo "2. Login: railway login"
echo "3. Deploy: railway up"
echo "4. Set environment variables in Railway dashboard:"
echo "   - ELEVENLABS_API_KEY"
echo "   - ELEVENLABS_AGENT_ID"
echo "   - PORT=6000"
echo "5. Copy your Railway URL (e.g., your-app.railway.app)"
