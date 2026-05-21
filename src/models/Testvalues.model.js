import mongoose, { Schema } from "mongoose";

// const ValueAnsIdSchema = new Schema({
//     currentvalue: String,
//     TestinputId: String,
//     isDocumented: String
// })
// const BookedTestsValues = new Schema({
//     BookingId: mongoose.Types.ObjectId,
//     EnteredValues: [ValueAnsIdSchema],
// },
// {
//     timestamps: true
// }
// )
const bookedTestSchema = new mongoose.Schema({
    BookingId: mongoose.Types.ObjectId,
    EnteredValues: {
      type: Object, // Ensure karo ki yeh object ho
      default: {}   // Yeh ensure karega ki naye documents ke liye empty object aaye
    }
  });
  

bookedTestSchema.index({ BookingId: 1 });

const bookedTestsresult = mongoose.model("BookedTestsValues", bookedTestSchema);

export { bookedTestsresult };
