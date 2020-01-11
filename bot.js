const Recognizers = require('@microsoft/recognizers-text-suite');
const { ActivityHandler } = require('botbuilder');
const OrderSchema = require('./db/schema/order');
// The accessor names for the conversation flow and user profile state property accessors.
const CONVERSATION_FLOW_PROPERTY = 'CONVERSATION_FLOW_PROPERTY';
const USER_PROFILE_PROPERTY = 'USER_PROFILE_PROPERTY';

// Identifies the last question asked.
const question = {
    name: 'name',
    age: 'age',
    itemNumber: 'item',
    address: 'address',
    none: 'none'
};

const itemMap = {
    1: 'Non-Veg Pizza',
    2: 'Veg Pizza',
    3: 'Italian Pizza'
};

const orderStatus = ['your order is being prepared', 'your order is in your way']

// Defines a bot for filling a user profile.
class CustomPromptBot extends ActivityHandler {
    constructor(conversationState, userState) {
        super();
        // The state property accessors for conversation flow and user profile.
        this.conversationFlow = conversationState.createProperty(CONVERSATION_FLOW_PROPERTY);
        this.userProfile = userState.createProperty(USER_PROFILE_PROPERTY);

        // The state management objects for the conversation and user.
        this.conversationState = conversationState;
        this.userState = userState;

        this.onMessage(async (turnContext, next) => {
            const flow = await this.conversationFlow.get(turnContext, { lastQuestionAsked: question.itemNumber, details: {} });
            const profile = await this.userProfile.get(turnContext, {});
            if(turnContext.activity.text === 'track'){
                await turnContext.sendActivity(orderStatus[Math.floor(Math.random()*orderStatus.length)]);
            } else {
                await CustomPromptBot.fillOutUserProfile(flow, profile, turnContext);
            }
            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });

        this.onMembersAdded(async (context, next) => {
            const membersAdded = context.activity.membersAdded;
            for (let cnt = 0; cnt < membersAdded.length; ++cnt) {
                if (membersAdded[cnt].id !== context.activity.recipient.id) {
                    await context.sendActivity('Hello and welcome!');
                    await context.sendActivity('Please checkout our Menu for your delicious food!');
                    await context.sendActivity('1.Non-Veg Pizza (Supreme combination of black olives, onion, capsicum, grilled mushroom, pepper barbecue chicken)![](https://www.tasteofhome.com/wp-content/uploads/2017/10/Chicken-Pizza_exps30800_FM143298B03_11_8bC_RMS-2-696x696.jpg "Non-Veg Pizza")');
                    await context.sendActivity('2.Veg Pizza (Flavorful trio of juicy paneer, crisp capsicum with spicy red paprika)![](https://images.unsplash.com/photo-1513104890138-7c749659a591?ixlib=rb-1.2.1&dpr=1&auto=format&fit=crop&w=416&h=312&q=60 "Veg Pizza")');
                    await context.sendActivity('3.Italian Pizza (The wholesome flavour of tandoori masala with Chicken tikka, onion, red paprika & mint mayo)![](https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjE0MjB9&auto=format&fit=crop&w=414&q=80 "Italian Pizza")');
                    await context.sendActivity('Please enter number to place your Order(**1-Nonveg, 2-Veg, 3-Italian**)');
                }
            }
            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });

        this.onDialog(async (context, next) => {
            // Save any state changes. The load happened during the execution of the Dialog.
            await this.conversationState.saveChanges(context, false);
            await this.userState.saveChanges(context, false);

            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });
    }

    // Manages the conversation flow for filling out the user's profile.
    static async fillOutUserProfile(flow, profile, turnContext) {
        const input = turnContext.activity.text;
        let result;
        const details = flow.details;
        switch (flow.lastQuestionAsked) {
        case question.itemNumber:
            var itemNumber = parseInt(input);
            if (isNaN(itemNumber) || !itemMap[itemNumber]) {
                await turnContext.sendActivity('Please enter valid input');
            } else {
                await turnContext.sendActivity("Please enter your name?");
                flow.lastQuestionAsked = question.name;
                flow.details = { ...details, itemNumber };
            }

            break;

        case question.name:
            result = this.validateName(input);
            if (result.success) {
                profile.name = result.name;
                await turnContext.sendActivity(`I have your name as ${ profile.name }.`);
                await turnContext.sendActivity('How old are you?');
                flow.lastQuestionAsked = question.age;
                flow.details = { ...details, name: result.name };
            } else {
                await turnContext.sendActivity(result.message || "I'm sorry, I didn't understand that.");
            }
            break;

        // If we last asked for their age, record their response, confirm that we got it.
        // Ask them for their date preference and update the conversation flag.
        case question.age:
            result = this.validateAge(input);
            if (result.success) {
                profile.age = result.age;
                await turnContext.sendActivity(`I have your age as ${ profile.age }.`);
                await turnContext.sendActivity('Enter your delivery address');
                flow.lastQuestionAsked = question.address;
                flow.details = { ...details, age: result.age };
            } else {
                await turnContext.sendActivity(result.message || "I'm sorry, I didn't understand that.");
            }
            break;

        case question.address:
            flow.details = { ...details, address: input };
            var value = await this.saveOder(flow.details);
            await turnContext.sendActivity(`Your Order of ${ itemMap[value.itemNumber] } is Placed with id ${ value._id }, will be ready in 30min.`);
            await turnContext.sendActivity('Thanks for choosing us!, Enjoy your food, please enter \'track\' if you want to check your food status.');
            flow.lastQuestionAsked = question.none;
            break;
        }
    }

    static async saveOder(details) {
        const order = new OrderSchema(details);
        return order.save();
    }

    static validateName(input) {
        const name = input && input.trim();
        return name !== undefined
            ? { success: true, name: name }
            : { success: false, message: 'Please enter a name that contains at least one character.' };
    };

    static validateAge(input) {
        // Try to recognize the input as a number. This works for responses such as "twelve" as well as "12".
        try {
            // Attempt to convert the Recognizer result to an integer. This works for "a dozen", "twelve", "12", and so on.
            // The recognizer returns a list of potential recognition results, if any.
            const results = Recognizers.recognizeNumber(input, Recognizers.Culture.English);
            let output;
            results.forEach(result => {
                // result.resolution is a dictionary, where the "value" entry contains the processed string.
                const value = result.resolution.value;
                if (value) {
                    const age = parseInt(value);
                    if (!isNaN(age) && age >= 18 && age <= 120) {
                        output = { success: true, age: age };
                    }
                }
            });
            return output || { success: false, message: 'Please enter an age between 18 and 120.' };
        } catch (error) {
            return {
                success: false,
                message: "I'm sorry, I could not interpret that as an age. Please enter an age between 18 and 120."
            };
        }
    };
}

module.exports.CustomPromptBot = CustomPromptBot;
