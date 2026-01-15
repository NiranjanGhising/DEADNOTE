const quotes = [
    { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
    { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
    { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
    { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
    { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
    { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
    { text: "Everything you've ever wanted is on the other side of fear.", author: "George Addair" },
    { text: "The only impossible journey is the one you never begin.", author: "Tony Robbins" },
    { text: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
    { text: "Your limitation—it's only your imagination.", author: "Unknown" },
    { text: "Push yourself, because no one else is going to do it for you.", author: "Unknown" },
    { text: "Great things never come from comfort zones.", author: "Unknown" },
    { text: "Dream it. Wish it. Do it.", author: "Unknown" },
    { text: "Success doesn't just find you. You have to go out and get it.", author: "Unknown" },
    { text: "The harder you work for something, the greater you'll feel when you achieve it.", author: "Unknown" },
    { text: "Don't stop when you're tired. Stop when you're done.", author: "Unknown" },
    { text: "Wake up with determination. Go to bed with satisfaction.", author: "Unknown" },
    { text: "Do something today that your future self will thank you for.", author: "Sean Patrick Flanery" },
    { text: "Little things make big days.", author: "Unknown" },
    { text: "It's going to be hard, but hard does not mean impossible.", author: "Unknown" },
    { text: "Don't wait for opportunity. Create it.", author: "Unknown" },
    { text: "Sometimes we're tested not to show our weaknesses, but to discover our strengths.", author: "Unknown" },
    { text: "The key to success is to focus on goals, not obstacles.", author: "Unknown" },
    { text: "Dream bigger. Do bigger.", author: "Unknown" },
    { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
    { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
    { text: "Don't be afraid to give up the good to go for the great.", author: "John D. Rockefeller" },
    { text: "I find that the harder I work, the more luck I seem to have.", author: "Thomas Jefferson" },
    { text: "Success usually comes to those who are too busy to be looking for it.", author: "Henry David Thoreau" },
    { text: "If you are not willing to risk the usual, you will have to settle for the ordinary.", author: "Jim Rohn" },
    { text: "Take up one idea. Make that one idea your life.", author: "Swami Vivekananda" },
    { text: "All progress takes place outside the comfort zone.", author: "Michael John Bobak" },
    { text: "You miss 100% of the shots you don't take.", author: "Wayne Gretzky" },
    { text: "Whether you think you can or think you can't, you're right.", author: "Henry Ford" },
    { text: "The only person you are destined to become is the person you decide to be.", author: "Ralph Waldo Emerson" },
    { text: "I attribute my success to this: I never gave or took any excuse.", author: "Florence Nightingale" },
    { text: "If you really look closely, most overnight successes took a long time.", author: "Steve Jobs" },
    { text: "The successful warrior is the average man, with laser-like focus.", author: "Bruce Lee" },
    { text: "There are no secrets to success. It is the result of preparation, hard work, and learning from failure.", author: "Colin Powell" },
    { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
    { text: "Things work out best for those who make the best of how things work out.", author: "John Wooden" },
    { text: "A year from now you may wish you had started today.", author: "Karen Lamb" },
    { text: "Small daily improvements over time lead to stunning results.", author: "Robin Sharma" },
    { text: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn" },
    { text: "What you do today can improve all your tomorrows.", author: "Ralph Marston" },
    { text: "The difference between ordinary and extraordinary is that little extra.", author: "Jimmy Johnson" },
    { text: "Your time is limited, don't waste it living someone else's life.", author: "Steve Jobs" },
    { text: "Be so good they can't ignore you.", author: "Steve Martin" },
    { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" }
];

// Get a quote based on time of day
function getMotivationalQuote() {
    const hour = new Date().getHours();
    let category;

    if (hour < 12) {
        // Morning - energizing quotes
        category = quotes.filter(q => 
            q.text.toLowerCase().includes('start') || 
            q.text.toLowerCase().includes('begin') ||
            q.text.toLowerCase().includes('today')
        );
    } else if (hour < 17) {
        // Afternoon - persistence quotes
        category = quotes.filter(q => 
            q.text.toLowerCase().includes('keep') || 
            q.text.toLowerCase().includes('continu') ||
            q.text.toLowerCase().includes('work')
        );
    } else {
        // Evening - reflection quotes
        category = quotes.filter(q => 
            q.text.toLowerCase().includes('success') || 
            q.text.toLowerCase().includes('great') ||
            q.text.toLowerCase().includes('achieve')
        );
    }

    // If no category match, use all quotes
    const pool = category.length > 0 ? category : quotes;
    return pool[Math.floor(Math.random() * pool.length)];
}

module.exports = {
    quotes,
    getMotivationalQuote
};
