import { IFriendRequst } from "../models/friendRequst.model";
import { DataBaseRepository } from "./database.repository";
import { Model } from "mongoose";

export class FriendRequstRepository extends DataBaseRepository<IFriendRequst> {

    constructor(protected override readonly model: Model<IFriendRequst>) {
        super(model)
    }

}