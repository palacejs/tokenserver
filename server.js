const express = require('express');
const fs = require('fs');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const FILE_PATH = 'tokens.json';

// 🔄 Süresi geçmiş tokenları temizle
function cleanExpiredTokens(data) {
    const now = new Date();
    const validTokens = data.tokens.filter(entry => {
        const exp = new Date(entry.expiresAt);
        return exp > now && !isNaN(exp); // geçerli tarih kontrolü
    });
    return {
        count: validTokens.length,
        tokens: validTokens
    };
}

// 📥 Token kaydetme endpointi
app.post('/save-token', (req, res) => {
    const { jwt } = req.body;
    if (!jwt) return res.status(400).json({ error: 'JWT missing' });

    fs.readFile(FILE_PATH, 'utf8', (err, data) => {
        let tokenData = { count: 0, tokens: [] };

        if (!err && data) {
            try {
                tokenData = JSON.parse(data);
                tokenData = cleanExpiredTokens(tokenData); // önce expired olanları sil
            } catch (e) {
                console.error('JSON parse error:', e);
            }
        }

        const exists = tokenData.tokens.find(entry => entry.token === jwt);
        if (exists) return res.json({ message: 'Token already exists' });

        const now = new Date();
        const expires = new Date(now.getTime() + 3.5 * 60 * 60 * 1000); // 🔧 3.5 saat geçerlilik

        tokenData.tokens.push({
            token: jwt,
            createdAt: now.toISOString(),
            expiresAt: expires.toISOString()
        });

        tokenData.count = tokenData.tokens.length;

        fs.writeFile(FILE_PATH, JSON.stringify(tokenData, null, 2), err => {
            if (err) {
                console.error('Write error:', err);
                return res.status(500).json({ error: 'Failed to save token' });
            }
            console.log('✅ Token saved');
            res.json({ message: 'Token saved with timestamp' });
        });
    });
});

// 📤 Tokenları görüntüleme endpointi
app.get('/tokens', (req, res) => {
    fs.readFile(FILE_PATH, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Failed to read tokens' });
        try {
            let tokenData = JSON.parse(data);
            tokenData = cleanExpiredTokens(tokenData); // expired'ları gösterme
            res.json(tokenData);
        } catch (e) {
            res.status(500).json({ error: 'Invalid JSON structure' });
        }
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
