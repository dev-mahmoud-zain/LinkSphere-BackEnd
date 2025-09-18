import { RoleEnum } from "../../DataBase/models/user.model";

export const endPoints = {
    freezAccount: [RoleEnum.admin, RoleEnum.user],
    unFreezAccountByAdmin: [RoleEnum.admin],
    deleteAccount: [RoleEnum.admin],
}