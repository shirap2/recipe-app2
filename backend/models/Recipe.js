const mongoose =require('mongoose');

const RecipeSchema=new mongoose.Schema({
    title:{
        type: String,
        required: [true,'Recipe title is required'],
        trim: true,
        minLength: [3, 'Title must be at least 3 characters long']

    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    source: {
      type: String,
      default: 'Custom'  // Could be 'Custom', 'URL', 'Image', etc.
    },
    sourceUrl: String,
    sourceImage: String,

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
        type: String
      }],

      prepTime: Number,
      cookTime: Number,
       
      servings: Number,
      tags: [String],
      notes: String,

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

// Add text index for searching
RecipeSchema.index({ title: 'text', tags: 'text' });

// update the updatedAt field before saving
RecipeSchema.pre('save',function(next){
    this.updateAt=new Date();
    next();
});

module.exports=mongoose.model('Recipe', RecipeSchema);