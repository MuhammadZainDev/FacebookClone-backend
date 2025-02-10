const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

const generateTitle = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const prompt = `Generate a short, engaging social media caption with emojis and hashtags. after reading image Follow these examples:

        Cars:
        "Living the Mercedes life ⭐️🖤 #MercedesBenz #LuxuryLife"
        "BMW excellence ⚡️🏎️ #BMWNation #DrivingPleasure"

        Food:
        "Coffee and good vibes ☕️💫 #CafeLife #CoffeeTime"
        "Foodie heaven 🍽️✨ #FoodieLife #Delicious"

        Travel:
        "Paradise found 🏖️🌊 #BeachLife #Vacation"
        "City lights 🌆✨ #CityLife #Urban"

        Selfies:
        "Living my best life 😊✨ #GoodVibes #Happy"
        "Squad goals 🤗💫 #Friends #BestDay"

        Fitness:
        "No pain no gain 💪🔥 #FitLife #Workout"
        "Game day energy ⚽️🏆 #Sports #Winning"

        Rules:
        1. Keep it under 50 characters
        2. Use 2-3 emojis
        3. Add 2-3 hashtags
        4. Make it casual and fun

        Generate only the caption, nothing else.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const title = response.text();

        res.json({
            success: true,
            title: title.trim()
        });
    } catch (error) {
        console.error('AI Title Generation Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating title',
            error: error.message
        });
    }
};

module.exports = {
    generateTitle
}; 