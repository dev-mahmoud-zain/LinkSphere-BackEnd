import { HydratedDocument, model, models, Schema, Types } from "mongoose";

export interface IFriendRequst {    
    sendBy: Types.ObjectId;
    sendTo: Types.ObjectId;
    acceptedAt?:Date;

    cretedAt: Date;
    updatedAt?: Date;
}

export type HFriendRequst = HydratedDocument<IFriendRequst>;

const friendRequstSchima = new Schema<IFriendRequst>({
    sendBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sendTo: { type: Schema.Types.ObjectId, ref: "User", required: true },
    acceptedAt: Date,
    cretedAt: Date,
    updatedAt: Date,

}, {
    timestamps: true,
    strictQuery: true,
});

export const FriendRequstModel = models.FriendRequstModel || model("FriendRequst", friendRequstSchima);