const https = require('https');
const fs = require('fs');
const crypto = require('crypto');

const platforms = [
    { name: 'Claude', urls: ['https://www.anthropic.com/privacy', 'https://www.anthropic.com/terms'] },
    { name: 'ChatGPT', urls: ['https://openai.com/privacy/', 'https://openai.com/terms/'] },
    { name: 'Gemini', urls: ['https://policies.google.com/privacy', 'https://policies.google.com/terms'] },
    { name: 'Perplexity', urls: ['https://www.perplexity.ai/privacy', 'https://www.perplexity.ai/terms'] },
    { name: 'Midjourney', urls: ['https://docs.midjourney.com/docs/privacy-policy', 'https://docs.midjourney.com/docs/terms-of-service'] },
    { name: 'Copilot', urls: ['https://privacy.microsoft.com/privacystatement', 'https://www.microsoft.com/servicesagreement'] },
    { name: 'ElevenLabs', urls: ['https://elevenlabs.io/privacy', 'https://elevenlabs.io/terms'] }
];

async function fetchWithGemini(text, previousText = null) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.log('No Gemini API key found, using fallback summary');
        return previousText ? 'Policy document has been updated. Please review manually.' : 'Policy document summary available.';
    }

    const prompt = previousText 
        ? `Compare these two policy documents and summarize any significant changes in a friendly, colleague-like tone. Focus on what an Australian public servant should know. Keep it concise and highlight any changes related to data handling, privacy, or terms that might affect government use:\n\nPREVIOUS VERSION:\n${previousText.substring(0, 3000)}\n\nNEW VERSION:\n${text.substring(0, 3000)}`
        : `Summarize this policy document for an Australian public servant in a friendly, colleague-like tone. Focus on key points about data handling, privacy, and terms that might affect government use:\n\n${text.substring(0, 5000)}`;

    const postData = JSON.stringify({
        contents: [{
            parts: [{
                text: prompt
            }]
        }]
    });

    const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (response.candidates && response.candidates[0] && response.candidates[0].content) {
                        resolve(response.candidates[0].content.parts[0].text);
                    } else {
                        resolve('Summary could not be generated. Please review manually.');
                    }
                } catch (error) {
                    console.error('Error parsing Gemini response:', error);
                    resolve('Summary could not be generated. Please review manually.');
                }
            });
        });

        req.on('error', (error) => {
            console.error('Error calling Gemini API:', error);
            resolve('Summary could not be generated. Please review manually.');
        });

        req.write(postData);
        req.end();
    });
}

async function checkPlatformUpdates() {
    console.log('Starting platform updates check...');
    
    for (const platform of platforms) {
        console.log(`Checking ${platform.name}...`);
        
        for (const url of platform.urls) {
            try {
                console.log(`  Fetching ${url}...`);
                const content = await fetchContent(url);
                const hash = crypto.createHash('md5').update(content).digest('hex');
                
                const urlPath = url.split('/').pop() || 'index';
                const previousPath = `snapshots/platforms/${platform.name}-${urlPath}.txt`;
                const hashPath = `snapshots/platforms/${platform.name}-${urlPath}.hash`;
                
                let previousHash = null;
                if (fs.existsSync(hashPath)) {
                    previousHash = fs.readFileSync(hashPath, 'utf8').trim();
                }

                if (hash !== previousHash) {
                    console.log(`  📢 Change detected for ${platform.name} - ${url}`);
                    
                    const previousContent = fs.existsSync(previousPath) ? fs.readFileSync(previousPath, 'utf8') : null;
                    console.log('  🤖 Generating summary with Gemini...');
                    const summary = await fetchWithGemini(content, previousContent);
                    
                    // Save new snapshot and hash
                    fs.writeFileSync(previousPath, content);
                    fs.writeFileSync(hashPath, hash);
                    
                    // Update tracking data
                    updateTrackingData(platform.name, url, summary);
                    
                    console.log(`  ✅ Updated tracking data for ${platform.name}`);
                } else {
                    console.log(`  ✓ No changes for ${platform.name} - ${url}`);
                }
            } catch (error) {
                console.error(`  ❌ Error checking ${platform.name} - ${url}:`, error.message);
                // Continue with other platforms even if one fails
            }
        }
    }
    
    console.log('Platform updates check completed.');
}

function updateTrackingData(platformName, url, summary) {
    const updatesPath = 'data/updates.json';
    let updates = [];
    
    if (fs.existsSync(updatesPath)) {
        try {
            updates = JSON.parse(fs.readFileSync(updatesPath, 'utf8'));
        } catch (error) {
            console.error('Error reading existing updates:', error);
            updates = [];
        }
    }
    
    const urlType = url.includes('privacy') ? 'Privacy Policy' : 'Terms of Service';
    
    updates.unshift({
        id: Date.now(),
        platform: platformName,
        url: url,
        type: 'updated',
        title: `${platformName} ${urlType} Update`,
        summary: summary,
        timestamp: new Date().toISOString(),
        action_required: summary.toLowerCase().includes('data') || 
                        summary.toLowerCase().includes('privacy') || 
                        summary.toLowerCase().includes('government') ||
                        summary.toLowerCase().includes('australia')
    });
    
    // Keep only last 50 updates
    updates = updates.slice(0, 50);
    
    try {
        fs.writeFileSync(updatesPath, JSON.stringify(updates, null, 2));
    } catch (error) {
        console.error('Error writing updates file:', error);
    }
}

function fetchContent(url) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; AI-Steward-Tracker/1.0; +https://github.com/Thomas-Amann-IPAustralia/ai-steward-tracker)'
            }
        };

        https.get(url, options, (res) => {
            // Follow redirects
            if (res.statusCode === 301 || res.statusCode === 302) {
                return https.get(res.headers.location, options, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => resolve(data));
                }).on('error', reject);
            }
            
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                return;
            }
            
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

// Ensure directories exist
console.log('Creating necessary directories...');
['data', 'snapshots', 'snapshots/platforms', 'scripts'].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
    }
});

// Run the check
checkPlatformUpdates().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
