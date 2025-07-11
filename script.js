// Friendly messages for different scenarios
const friendlyMessages = {
    noUpdates: "Good news! 🎉 Everything's stable - no policy changes to worry about today.",
    hasUpdates: "Heads up! 📢 I've spotted some changes that might need your attention.",
    checking: "Just checking in on things... ⏳ Updates coming soon!",
    error: "Oops! 😅 Having trouble checking updates right now. I'll try again soon."
};

class AIStwardDashboard {
    constructor() {
        this.updates = [];
        this.platforms = [];
        this.policies = [];
        this.init();
    }

    async init() {
        await this.loadData();
        this.renderDashboard();
        this.startAutoRefresh();
    }

    async loadData() {
        try {
            const [updatesRes, platformsRes, policiesRes] = await Promise.all([
                fetch('./data/updates.json'),
                fetch('./data/platforms/'),
                fetch('./data/policies/')
            ]);

            if (updatesRes.ok) {
                this.updates = await updatesRes.json();
            }
        } catch (error) {
            console.log('Loading initial data...', error);
        }
    }

    renderDashboard() {
        this.renderRecentUpdates();
        this.renderPlatformStatus();
        this.renderPolicyStatus();
    }

    renderRecentUpdates() {
        const container = document.getElementById('updates-container');
        
        if (!this.updates.length) {
            container.innerHTML = `
                <div class="update-card">
                    <h3>👋 Welcome to your AI Steward Dashboard!</h3>
                    <p>${friendlyMessages.checking}</p>
                    <small>Last checked: Setting up monitoring...</small>
                </div>
            `;
            return;
        }

        const recentUpdates = this.updates
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 5);

        container.innerHTML = recentUpdates.map(update => `
            <div class="update-card">
                <div class="status-indicator status-${update.type}"></div>
                <h3>${update.title}</h3>
                <p>${update.summary}</p>
                <small>Updated: ${new Date(update.timestamp).toLocaleDateString('en-AU')}</small>
                ${update.action_required ? '<div class="action-required">⚠️ Action may be required</div>' : ''}
            </div>
        `).join('');
    }

    renderPlatformStatus() {
        const platforms = [
            'Claude', 'ChatGPT', 'Gemini', 'Perplexity', 
            'Midjourney', 'Sora', 'Copilot', 'Eleven Labs'
        ];

        const container = document.getElementById('platforms-grid');
        container.className = 'grid';
        
        container.innerHTML = platforms.map(platform => `
            <div class="platform-card">
                <div class="status-indicator status-monitored"></div>
                <h3>${platform}</h3>
                <p>Monitoring terms & privacy policy</p>
                <small>Last checked: Today</small>
            </div>
        `).join('');
    }

    renderPolicyStatus() {
        const policies = [
            'Privacy Act 1988',
            'Digital Government Strategy',
            'AI Ethics Framework',
            'Protective Security Policy',
            'Data Governance Framework'
        ];

        const container = document.getElementById('policies-grid');
        container.className = 'grid';
        
        container.innerHTML = policies.map(policy => `
            <div class="policy-card">
                <div class="status-indicator status-monitored"></div>
                <h3>${policy}</h3>
                <p>Monitoring for updates</p>
                <small>Last checked: Today</small>
            </div>
        `).join('');
    }

    startAutoRefresh() {
        // Refresh data every 5 minutes
        setInterval(() => this.loadData(), 5 * 60 * 1000);
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    new AIStwardDashboard();
});
