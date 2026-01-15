const express = require('express');
const router = express.Router();
const { getMotivationalQuote, quotes } = require('../utils/quotes');

// Get AI tips for goals/todos
router.post('/tips', async (req, res) => {
    const { context, items } = req.body;

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
        // Fallback to curated tips
        return res.json({
            tips: getFallbackTips(context, items),
            source: 'curated'
        });
    }

    try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const prompt = buildPrompt(context, items);
        
        const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: 'You are a supportive personal productivity coach. Provide brief, actionable tips (2-3 sentences each) to help users achieve their goals and complete their tasks. Be encouraging but practical.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 300,
            temperature: 0.7
        });

        res.json({
            tips: completion.choices[0].message.content,
            source: 'ai'
        });
    } catch (error) {
        console.error('AI tips error:', error);
        // Fallback to curated tips on error
        res.json({
            tips: getFallbackTips(context, items),
            source: 'curated'
        });
    }
});

// Get motivational quote
router.get('/quote', (req, res) => {
    const quote = getMotivationalQuote();
    res.json(quote);
});

// Get random motivational quote
router.get('/quote/random', (req, res) => {
    const quote = quotes[Math.floor(Math.random() * quotes.length)];
    res.json(quote);
});

// Helper function to build prompt for AI
function buildPrompt(context, items) {
    let prompt = '';

    if (context === 'todos') {
        prompt = `I have these tasks to complete today:\n`;
        items.forEach((item, i) => {
            prompt += `${i + 1}. ${item.title} (Priority: ${item.priority})\n`;
        });
        prompt += '\nGive me 3 practical tips to help me complete these tasks efficiently.';
    } else if (context === 'goals') {
        prompt = `I'm working on these goals:\n`;
        items.forEach((item, i) => {
            prompt += `${i + 1}. ${item.title} (Progress: ${item.progress}%, Type: ${item.goal_type})\n`;
        });
        prompt += '\nGive me 3 actionable tips to make progress on these goals this week.';
    } else if (context === 'motivation') {
        prompt = `I'm feeling unmotivated today. I have ${items.pendingCount} tasks pending and ${items.goalCount} active goals. Give me an encouraging message and 2-3 practical tips to get started.`;
    }

    return prompt;
}

// Fallback tips when AI is not available
function getFallbackTips(context, items) {
    const todoTips = [
        "🎯 Start with the most important task first - tackling it early gives you momentum for the rest of the day.",
        "⏱️ Try the Pomodoro technique: 25 minutes of focused work, then a 5-minute break.",
        "✂️ If a task feels overwhelming, break it into smaller, manageable steps.",
        "🚫 Turn off notifications and find a quiet space to minimize distractions.",
        "🎁 Reward yourself after completing difficult tasks to build positive habits."
    ];

    const goalTips = [
        "📅 Schedule dedicated time blocks for your goals - treat them like important meetings.",
        "🪜 Focus on progress, not perfection. Small steps forward are still steps forward.",
        "📊 Review your goals weekly to stay aligned and adjust your approach if needed.",
        "👥 Share your goals with someone who can hold you accountable.",
        "🎯 Visualize achieving your goal - imagine how it will feel when you succeed."
    ];

    const motivationTips = [
        "💪 Remember: you don't have to feel motivated to take action. Action often creates motivation.",
        "🌱 Start with just 2 minutes. Often, getting started is the hardest part.",
        "📝 Write down one thing you're grateful for - it shifts your mindset positively.",
        "🔄 Progress isn't always linear. Bad days are part of the journey.",
        "⭐ You've overcome challenges before. You have the strength to do it again."
    ];

    let tips;
    if (context === 'todos') {
        tips = todoTips.sort(() => 0.5 - Math.random()).slice(0, 3);
    } else if (context === 'goals') {
        tips = goalTips.sort(() => 0.5 - Math.random()).slice(0, 3);
    } else {
        tips = motivationTips.sort(() => 0.5 - Math.random()).slice(0, 3);
    }

    return tips.join('\n\n');
}

module.exports = router;
