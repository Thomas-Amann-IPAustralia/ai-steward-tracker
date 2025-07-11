const https = require('https');
const fs = require('fs');
const crypto = require('crypto');

const platforms = [
    { name: 'Claude', urls: ['https://www.anthropic.com/privacy', 'https://www.anthropic.com/terms'] },
    { name: 'ChatGPT', urls: ['https://openai.com/privacy/', 'https://openai.com/terms/'] },
    { name: 'Gemini', urls: ['https://policies.google.com/privacy', 'https://policies.google.com/terms'] },
    // Add other platforms
];

async function fetchWithGemini(text, previousText = null) {
    const prompt = previousText 
        ? `Compare these two policy documents and summarize any significant changes in a friendly, colleague-like tone. Focus on what an Australian public servant should know:\n\nPREVIOUS VERSION:\n${previousText}\n\nNEW VERSION:\n${text}`
        : `Summarize this policy document for an Australian public servant in a friendly, colleague-like tone:\n\n${text}`;

    // Implementation depends on Gemini API structure
    // This is a placeholder for the actual API call
    return "Friendly summary from Gemini";
}

async function checkPlatformUpdates() {
    for (const platform of platforms) {
        for (const url of platform.urls) {
            try {
                const content = await fetchContent(url);
                const hash = crypto.createHash('md5').update(content).digest('hex');
                
                const previousPath = `snapshots/platforms/${platform.name}-${url.split('/').pop()}.txt`;
                const previousHash = fs.existsSync(previousPath) 
                    ? crypto.createHash('md5').update(fs.readFileSync(previousPath, 'utf8')).digest('hex')
                    : null;

                if (hash !== previousHash) {
                    console.log(`Change detected for ${platform.name} - ${url}`);
                    
                    const previousContent = previousHash ? fs.readFileSync(previousPath, 'utf8') : null;
                    const summary = await fetchWithGemini(content, previousContent);
                    
                    // Save new snapshot
                    fs.writeFileSync(previousPath, content);
                    
                    // Update tracking data
                    updateTrackingData(platform.name, url, summary);
                }
            } catch (error) {
                console.error(`Error checking ${platform.name} - ${url}:`, error);
            }
        }
    }
}

function updateTrackingData(platformName, url, summary) {
    const updatesPath = 'data/updates.json';
    let updates = [];
    
    if (fs.existsSync(updatesPath)) {
        updates = JSON.parse(fs.readFileSync(updatesPath, 'utf8'));
    }
    
    updates.unshift({
        id: Date.now(),
        platform: platformName,
        url: url,
        type: 'updated',
        title: `${platformName} Policy Update`,
        summary: summary,
        timestamp: new Date().toISOString(),
        action_required: summary.toLowerCase().includes('data') || summary.toLowerCase().includes('privacy')
    });
    
    // Keep only last 50 updates
    updates = updates.slice(0, 50);
    
    fs.writeFileSync(updatesPath, JSON.stringify(updates, null, 2));
}

function fetchContent(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

// Ensure directories exist
['data', 'snapshots', 'snapshots/platforms', 'scripts'].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

checkPlatformUpdates().catch(console.error);
