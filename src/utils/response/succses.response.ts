import { Response } from "express";
import { HCommentDucment, HPostDucment, HUserDoucment } from "../../DataBase/models";

export const succsesResponse = (
    {
        res,
        statusCode = 200,
        message = "Done",
        info,
        data
    }
        : {
            res: Response
            statusCode?: number,
            message?: string,
            info?: string | object
            data?: object | HUserDoucment |HPostDucment | HCommentDucment ,

        }): Response => {

    return res.status(statusCode).json({
        message,
        info,
        statusCode,
        data
    })

}