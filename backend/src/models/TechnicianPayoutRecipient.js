const mongoose = require('mongoose');
module.exports = mongoose.model('TechnicianPayoutRecipient',new mongoose.Schema({
  technician:{ type:mongoose.Schema.Types.ObjectId,ref:'User',required:true },
  provider:{ type:String,required:true }, programToken:{ type:String,required:true },
  userToken:{ type:String,required:true },bankToken:{ type:String,required:true },
  bankFingerprint:{ type:String,required:true,select:false },
  linkedBy:mongoose.Schema.Types.ObjectId,linkedAt:Date
},{ timestamps:true }).index({ technician:1,provider:1,programToken:1 },{ unique:true }));
