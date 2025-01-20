const mongoose =require('mongoose');

const RecipeSchema=new mongoose.Schema({
    title:{
        type: String,
        required: [true,'Recipe title is required'],
        trim: true,
        minLength: [3, 'Title must be at least 3 characters long']

    },

    ingredients:[{
        name:{
            type:String,
            required: [true,'Ingredient name is required']
        },
        amount: {
            type: Number,
            required: [true, 'Ingredient amount is required']
          },
          unit: {
            type: String,
            required: [true, 'Ingredient unit is required']
          }
    }],

    instructions: [{
        type: String,
        required: [true, 'At least one instruction is required']
      }],

      prepTime: {
        type: Number,
        min: [0, 'Preparation time cannot be negative']
      },
      cookTime: {
        type: Number,
        min: [0, 'Cooking time cannot be negative']
      },
      servings: {
        type: Number,
        min: [1, 'Must serve at least 1 person']
      },
      difficulty: {
        type: String,
        enum: ['Easy', 'Medium', 'Hard'],
        default: 'Medium'
      },
      createdAt: {
        type: Date,
        default: Date.now
      },
      updatedAt: {
        type: Date,
        default: Date.now
      }
});


// update the updatedAt field before saving
RecipeSchema.pre('save',function(next){
    this.updateAt=new Date();
    next();
});

module.exports=mongoose.model('Recipe', RecipeSchema);