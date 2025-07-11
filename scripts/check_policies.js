const https = require('https');
const fs = require('fs');
const crypto = require('crypto');

const policySources = [
    { 
        name: 'Digital Transformation Agency', 
        urls: [
            'https://www.dta.gov.au/our-projects/artificial-intelligence',
            'https://www.dta.gov.au/help-and-advice/digital-service-standard'
        ]
    },
    { 
        name: 'Department of Industry Science and Resources', 
        urls: [
            'https://www.industry.gov.au/science-technology-and-innovation/artificial-intelligence',
            'https://www.industry.gov.au/news'
        ]
    },
    { 
        name: 'PM&C - Department of Prime Minister and Cabinet', 
        urls: [
            'https://www.pmc.gov.au/news',
            'https://www.pmc.gov.au/public-data/artificial-intelligence'
        ]
    },
    { 
        name: 'Office of the Australian Information Commissioner', 
        urls: [
            'https://www.oaic.gov.au/privacy/guidance-and-advice',
            'https://www.oaic.gov.au/updates/news-and-media'
        ]
    },
    { 
        name: 'Australian Communications and Media Authority', 
        urls: [
            'https://www.acma.gov.au/publications',
            'https://www.acma.gov.au/artificial-intelligence-regulation'
        ]
    },
    { 
        name: 'Australian Public Service Commission', 
        urls: [
            'https://www.apsc.gov.au/working-aps/diversity-inclusion/digital-profession',
            'https://www.apsc.gov.au/publications-and-reports'
        ]
    },
    { 
        name: 'Treasury', 
        urls: [
            'https://treasury.gov.au/consultation',
            'https://treasury.gov.au/publication'
        ]
    },
    { 
        name: 'Department of Home Affairs', 
        urls: [
            'https://www.homeaffairs.gov.au/reports-and-publications',
            'https://www.homeaffairs.gov.au/news-subsite/news'
        ]
    }
];

async function fetchWithGemini(text, previousText = null, sourceName = '') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.log('No Gemini API key found, using fallback summary');
        return previousText ? 'Policy content has been updated. Please review manually for AI-related changes.' : 'Government policy content detected.';
    }

    const prompt = previousText 
        ? `Compare these two Australian government policy documents from ${sourceName} and summarize any significant changes in a friendly, colleague-like tone. Focus specifically on AI-related policy changes, new guidelines, regulations, or requirements that Australian public servants should know about. If there are no AI-related changes, say so clearly:\n\nPREVIOUS VERSION:\n${previousText.substring(0, 3000)}\n\nNEW VERSION:\n${text.substring(0, 3000)}`
        : `Analyze this Australian government policy document from ${sourceName} and summarize any AI-related content in a friendly, colleague-like tone. Focus on guidelines, regulations, or requirements that Australian public servants should know about. If there's no AI-related content, say so clearly:\n\n${text.substring(0, 5000)}`;

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
                        resolve('Policy summary could not be generated. Please review manually.');
                    }
                } catch (error) {
                    console.error('Error parsing Gemini response:', error);
                    resolve('Policy summary could not be generated. Please review manually.');
                }
            });
        });

        req.on('error', (error) => {
            console.error('Error calling Gemini API:', error);
            resolve('Policy summary could not be generated. Please review manually.');
        });

        req.write(postData);
        req.end();
    });
}

async function checkPolicyUpdates() {
    console.log('Starting Australian government policy updates check...');
    
    for (const source of policySources) {
        console.log(`Checking ${source.name}...`);
        
        for (const url of source.urls) {
            try {
                console.log(`  Fetching ${url}...`);
                const content = await fetchContent(url);
                
                // Only process if content seems to contain AI-related terms
                const aiRelated = containsAIContent(content);
                const hash = crypto.createHash('md5').update(content).digest('hex');
                
                const urlPath = url.split('/').pop() || 'index';
                const safeName = source.name.replace(/[^a-zA-Z0-9]/g, '-');
                const previousPath = `snapshots/policies/${safeName}-${urlPath}.txt`;
                const hashPath = `snapshots/policies/${safeName}-${urlPath}.hash`;
                
                let previousHash = null;
                if (fs.existsSync(hashPath)) {
                    previousHash = fs.readFileSync(hashPath, 'utf8').trim();
                }

                if (hash !== previousHash) {
                    console.log(`  📢 Change detected for ${source.name} - ${url}`);
                    
                    const previousContent = fs.existsSync(previousPath) ? fs.readFileSync(previousPath, 'utf8') : null;
                    console.log('  🤖 Analyzing content with Gemini...');
                    const summary = await fetchWithGemini(content, previousContent, source.name);
                    
                    // Only save and report if it's actually AI-related or if Gemini found AI content
                    if (aiRelated || summary.toLowerCase().includes('ai') || summary.toLowerCase().includes('artificial intelligence')) {
                        // Save new snapshot and hash
                        fs.writeFileSync(previousPath, content);
                        fs.writeFileSync(hashPath, hash);
                        
                        // Update tracking data
                        updateTrackingData(source.name, url, summary);
                        
                        console.log(`  ✅ Updated policy tracking data for ${source.name}`);
                    } else {
                        console.log(`  ℹ️  Change detected but no AI-related content found for ${source.name}`);
                        // Still save the snapshot for future comparison
                        fs.writeFileSync(previousPath, content);
                        fs.writeFileSync(hashPath, hash);
                    }
                } else {
                    console.log(`  ✓ No changes for ${source.name} - ${url}`);
                }
            } catch (error) {
                console.error(`  ❌ Error checking ${source.name} - ${url}:`, error.message);
                // Continue with other sources even if one fails
            }
        }
    }
    
    console.log('Australian government policy updates check completed.');
}

function containsAIContent(content) {
    const aiKeywords = [
        'artificial intelligence', 'machine learning', 'ai technology', 'ai system',
        'automated decision', 'algorithm', 'ai governance', 'ai strategy',
        'generative ai', 'large language model', 'chatbot', 'ai tool',
        'ai ethics', 'ai regulation', 'ai policy', 'ai guideline'
    ];
    
    const lowerContent = content.toLowerCase();
    return aiKeywords.some(keyword => lowerContent.includes(keyword));
}

function updateTrackingData(sourceName, url, summary) {
    const updatesPath = 'data/policy-updates.json';
    let updates = [];
    
    if (fs.existsSync(updatesPath)) {
        try {
            updates = JSON.parse(fs.readFileSync(updatesPath, 'utf8'));
        } catch (error) {
            console.error('Error reading existing policy updates:', error);
            updates = [];
        }
    }
    
    updates.unshift({
        id: Date.now(),
        source: sourceName,
        url: url,
        type: 'policy_update',
        title: `${sourceName} - AI Policy Update`,
        summary: summary,
        timestamp: new Date().toISOString(),
        action_required: summary.toLowerCase().includes('mandatory') || 
                        summary.toLowerCase().includes('requirement') || 
                        summary.toLowerCase().includes('must') ||
                        summary.toLowerCase().includes('compliance') ||
                        summary.toLowerCase().includes('deadline')
    });
    
    // Keep only last 30 policy updates (they're less frequent than platform updates)
    updates = updates.slice(0, 30);
    
    try {
        fs.writeFileSync(updatesPath, JSON.stringify(updates, null, 2));
    } catch (error) {
        console.error('Error writing policy updates file:', error);
    }
}

function fetchContent(url) {
    return new Promise((resolve, reject) => {
        // Set a timeout for government sites that might be slow
        const timeout = 30000; // 30 seconds
        
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; AI-Steward-Tracker/1.0; +https://github.com/Thomas-Amann-IPAustralia/ai-steward-tracker)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-AU,en;q=0.5',
                'Accept-Encoding': 'identity'
            },
            timeout: timeout
        };

        const req = https.get(url, options, (res) => {
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
        });
        
        req.setTimeout(timeout, () => {
            req.destroy();
            reject(new Error(`Timeout after ${timeout}ms for ${url}`));
        });
        
        req.on('error', reject);
    });
}

// Ensure directories exist
console.log('Creating necessary directories...');
['data', 'snapshots', 'snapshots/policies'].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
    }
});

// Run the check
checkPolicyUpdates().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
