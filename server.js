const express = require('express');
const fs = require('fs');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const FILE_PATH = 'tokens.json';
const TOKEN_EXPIRATION_HOURS = 3.5; // 3.5 saatlik geçerlilik süresi

// 🔄 Geçerli tokenları filtrele
function cleanExpiredTokens(data) {
    const now = new Date();
    const validTokens = data.tokens.filter(entry => new Date(entry.expiresAt) > now);
    return {
        count: validTokens.length,
        tokens: validTokens
    };
}

// 📥 Token kaydetme endpointi
app.post('/save-token', (req, res) => {
    const { jwt } = req.body;
    if (!jwt) return res.status(400).json({ error: 'JWT missing' });

    // Var olan dosyayı oku, bozuksa sıfırdan başla ama sıfırlama!
    fs.readFile(FILE_PATH, 'utf8', (err, data) => {
        let tokenData = { count: 0, tokens: [] };

        if (!err && data) {
            try {
                tokenData = JSON.parse(data);
            } catch (e) {
                console.error('⚠️ JSON parse error, dosya bozulmuş olabilir. Geriye kalan tokenları kurtarmaya çalışılıyor.');

                // Geçerli JSON olmayan veriden hatalı kısmı temizlemeye çalış
                const safeStart = data.indexOf('{');
                const safeEnd = data.lastIndexOf('}');
                if (safeStart !== -1 && safeEnd !== -1) {
                    try {
                        const fixed = data.slice(safeStart, safeEnd + 1);
                        tokenData = JSON.parse(fixed);
                    } catch (_) {
                        console.warn('Yine kurtarılamadı, boş JSON ile devam ediliyor.');
                        tokenData = { count: 0, tokens: [] };
                    }
                }
            }
        }

        tokenData = cleanExpiredTokens(tokenData); // Süresi geçenleri temizle

        const exists = tokenData.tokens.find(entry => entry.token === jwt);
        if (exists) return res.json({ message: 'Token already exists' });

        const now = new Date();
        const expires = new Date(now.getTime() + TOKEN_EXPIRATION_HOURS * 60 * 60 * 1000); // 3.5 saat sonrası

        tokenData.tokens.push({
            token: jwt,
            createdAt: now.toISOString(),
            expiresAt: expires.toISOString()
        });

        tokenData.count = tokenData.tokens.length;

        fs.writeFile(FILE_PATH, JSON.stringify(tokenData, null, 2), err => {
            if (err) {
                console.error('❌ Write error:', err);
                return res.status(500).json({ error: 'Failed to save token' });
            }
            console.log('✅ Token saved');
            res.json({ message: 'Token saved successfully' });
        });
    });
});

// 📤 Kayıtlı tokenları gösteren endpoint
app.get('/tokens', (req, res) => {
    fs.readFile(FILE_PATH, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Failed to read tokens' });

        try {
            let tokenData = JSON.parse(data);
            tokenData = cleanExpiredTokens(tokenData);
            res.json(tokenData);
        } catch (e) {
            res.status(500).json({ error: 'Invalid token file' });
        }
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
