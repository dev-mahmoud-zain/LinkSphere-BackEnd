import { Response, Request } from "express"
import {
    deleteFile,
    deleteFiles,
    deleteFolderByPrefix,
    getPreSigndUrl,
    uploadFile,
    uploadFiles
} from "../../utils/multer/s3.config";
import { ApplicationException, BadRequestException, NotFoundException } from "../../utils/response/error.response";
import { CommentRepository, PostRepository, UserRepository } from "../../DataBase/repository";
import { JwtPayload } from "jsonwebtoken";
import { succsesResponse } from "../../utils/response/succses.response";
import { IChangePassword } from "../001-auth/dto/auth.dto";
import { compareHash, generateHash } from "../../utils/security/hash.security";
import { generateOTP } from "../../utils/security/OTP";
import { emailEvent } from "../../utils/email/email.events";
import { CommentModel, PostModel, HUserDoucment, UserModel } from "../../DataBase/models";
import { Types } from "mongoose";

class UserServise {

    private userModel = new UserRepository(UserModel);
    private postModel = new PostRepository(PostModel);
    private commentModel = new CommentRepository(CommentModel);


    private unfreezUser = async (userId :Types.ObjectId) => {

        // Un UnFreez User
        await this.userModel.findOneAndUpdate({
            filter: {
                _id: userId,
            }, updateData: {
                $unset: {
                    freezedAt: "",
                    freezedBy: ""
                }
            }
        });

        // UnFreez All Posts And Comments For User 
        await this.postModel.updateMany({
            createdBy: userId,
            freezedAt: { $exists: true },
            freezedBy: { $exists: true },
        }, {
            $unset: {
                freezedAt: "",
                freezedBy: ""
            }
        });

        await this.commentModel.updateMany({
            createdBy: userId,
            freezedAt: { $exists: true },
            freezedBy: { $exists: true },
        }, {
            $unset: {
                freezedAt: "",
                freezedBy: ""
            }
        });

    }

    constructor() { }

    // ============================ Profile Management =============================

    profile = async (req: Request, res: Response): Promise<Response> => {


        const { password, twoSetupVerificationCode, twoSetupVerificationCodeExpiresAt, ...safeUser } = req.user?.toObject() as HUserDoucment;

        if (safeUser.picture) {
            const key = await getPreSigndUrl({ Key: safeUser.picture });
            safeUser.picture = key
        }

        if (safeUser.coverImages) {
            let keys = []
            for (const Key of safeUser.coverImages) {
                keys.push(await getPreSigndUrl({ Key }));
            }
            safeUser.coverImages = keys;
        }


        return succsesResponse({
            res,
            data: safeUser
        })

    }


    uploadProfilePicture = async (req: Request, res: Response): Promise<Response> => {

        const { _id } = req.tokenDecoded as JwtPayload

        const key = await uploadFile({
            file: req.file as Express.Multer.File,
            path: `users/${_id}`
        })

        const update = await this.userModel.updateOne({
            _id
        }, {
            picture: key
        })

        if (!update) {
            throw new BadRequestException("Fail To Upload Profile Picture")
        }

        return succsesResponse({
            res,
            info: "Profile Picture Uploaded Succses",
            data: { key }
        })


    }

    uploadCoverImages = async (req: Request, res: Response): Promise<Response> => {

        const { _id } = req.tokenDecoded as JwtPayload

        if (!req.files?.length) {
            throw new BadRequestException("No files uploaded")
        }

        const keys = await uploadFiles({
            files: req.files as Express.Multer.File[],
            path: `users/${req.tokenDecoded?._id}/cover`
        })

        await this.userModel.updateOne({ _id }, {
            coverImages: keys
        })

        return succsesResponse({
            res,
            info: "Profile Picture Uploaded Succses",
            data: { keys }
        })

    }

    deleteProfilePicture = async (req: Request, res: Response): Promise<Response> => {

        const { _id } = req.tokenDecoded as JwtPayload
        const Key = req.user?.picture;

        if (!Key) {
            throw new NotFoundException("User Has No Profile Picture")
        }

        const deleted = await deleteFile({ Key });

        if (!deleted) {
            throw new ApplicationException("Faild To Delete Profile Picture");
        }

        await this.userModel.updateOne({ _id }, {
            $unset: { picture: 1 }
        })

        return succsesResponse({
            res,
            info: "Profile Picture Deleted Succses",
        })



    }

    deleteCoverImages = async (req: Request, res: Response): Promise<Response> => {

        const { _id } = req.tokenDecoded as JwtPayload
        const urls = req.user?.coverImages;

        if (!urls?.length) {
            throw new NotFoundException("User Has No Cover Images")
        }

        const deleted = await deleteFiles({ urls });

        if (!deleted) {
            throw new ApplicationException("Faild To Delete Cover Images");
        }

        await this.userModel.updateOne({ _id }, {
            $unset: { coverImages: 1 }
        })

        return succsesResponse({
            res,
            info: "Cover Images Deleted Succses",
        })

    }

    // ========================= User Information Updates ==========================

    updateBasicInfo = async (req: Request, res: Response): Promise<Response> => {


        interface IUpdateData {
            firstName?: string,
            lastName?: string,
            phone?: string,
            gender?: string,
            slug?: string
        }

        let data: IUpdateData = {
            firstName: req.body.validData.userName.split(" ")[0],
            lastName: req.body.validData.userName.split(" ")[1],
            slug: req.body.validData.userName.replaceAll(/\s+/g, "-").toLocaleLowerCase(),
            phone: req.body.validData.phone,
            gender: req.body.validData.gender,
        };

        const oldData = await this.userModel.findOne({
            filter: {
                _id: req.user?._id,
            }
        })

        let issues = [];


        if (data.firstName && data.lastName) {
            if (oldData?.userName === `${data.firstName} ${data.lastName}`) {
                issues.push({
                    path: "userName",
                    message: "new userName Is The Same Old userName",
                })
            }
        }

        if (data.gender) {
            if (oldData?.gender === data.gender) {
                issues.push({
                    path: "gender",
                    message: "new gender Is The Same Old gender",
                })
            }
        }

        if (data.phone) {
            if (oldData?.phone === data.phone) {
                issues.push({
                    path: "phone",
                    message: "new phone Is The Same Old phone",
                })
            }
        }

        if (issues.length) {
            throw new BadRequestException("Invalid Update Data", { issues })
        }

        const user = await this.userModel.updateOne({
            _id: req.user?._id
        }, {
            $set: { ...data }
        })

        if (!user) {
            throw new BadRequestException("Fail To Update User Data");
        }

        return succsesResponse({
            res,
            info: "Data Updated Succses",
        })

    }

    updateEmail = async (req: Request, res: Response): Promise<Response> => {

        const newEmail = req.body.validData.email;

        const emailExists = await this.userModel.findOne({
            filter: { email: newEmail }
        })

        if (emailExists) {
            throw new BadRequestException("Email Is Alrady Exists");
        }

        const OTPCode = generateOTP();

        await this.userModel.updateOne({
            _id: req.user?._id
        }, { updateEmailOTP: OTPCode, newEmail })

        emailEvent.emit("confirmUpdatedEmail", { to: newEmail, OTPCode })

        return succsesResponse({
            res,
            info: "Verify Your Email",
        })

    }

    confirmUpdateEmail = async (req: Request, res: Response): Promise<Response> => {

        const OTP = req.body.validData.OTP;

        const user = await this.userModel.findOne({
            filter: {
                _id: req.user?._id,
            }, select: { updateEmailOTP: 1, updateEmailOTPExpiresAt: 1, newEmail: 1 }
        })

        if (!user?.updateEmailOTP || !user?.updateEmailOTPExpiresAt || !user?.newEmail) {
            throw new NotFoundException("No OTP Requsted For User");
        }

        if (!await compareHash(OTP, user.updateEmailOTP)) {
            throw new BadRequestException("Invalid OTP Code");
        }

        if (user.updateEmailOTPExpiresAt.getTime() <= Date.now()) {
            throw new BadRequestException("OTP Code Time Expired");
        }

        await this.userModel.updateOne({
            _id: req.user?._id,
        }, {
            $set: {
                email: user.newEmail,
                confirmedAt: new Date()
            },
            $unset: {
                updateEmailOTP: true,
                updateEmailOTPExpiresAt: true,
                newEmail: true
            }
        })


        return succsesResponse({
            res,
            info: "Verify Your Email",
        })

    }

    changePassword = async (req: Request, res: Response): Promise<Response> => {


        const { _id, email, password } = req.user as HUserDoucment;
        const { oldPassword, newPassword }: IChangePassword = req.body


        if (!await compareHash(oldPassword, password)) {
            throw new BadRequestException("Invalid Old Password")
        }

        const OTPCode = generateOTP();
        emailEvent.emit("changePassword", { to: email, OTPCode })


        await this.userModel.updateOne({
            _id
        }, {
            password: await generateHash(newPassword)
        })



        return succsesResponse({
            res,
            info: "Your Password Changed Succses"
        })



    }

    // ============================= Account Control ===============================

    freezAccount = async (req: Request, res: Response): Promise<Response> => {

        const adminId = req.tokenDecoded?._id;
        let { userId } = req.params;

        if (!userId) {
            // لنفسه Freez  يعمل 
            userId = adminId;
        }

        const freezedAccount = await this.userModel.updateOne({
            _id: userId,
            freezedAt: { $exists: false },
            freezedBy: { $exists: false },
        }, {
            $set: {
                freezedAt: new Date(),
                freezedBy: adminId,
                changeCredentialsTime: new Date()
            },
            $unset: {
                restoredAt: 1,
                restoredBy: 1
            }
        })

        if (!freezedAccount) {
            throw new BadRequestException("Faild To Freez Account")
        }

        // Freez All Posts And Comments For User 
        await this.postModel.updateMany({
            createdBy: userId,
            freezedAt: { $exists: false },
            freezedBy: { $exists: false },
        }, {
            $set: {
                freezedAt: new Date(),
                freezedBy: adminId,
            },
            $unset: {
                restoredAt: 1,
                restoredBy: 1
            }
        })

        await this.commentModel.updateMany({
            createdBy: userId,
            freezedAt: { $exists: false },
            freezedBy: { $exists: false },
        }, {
            $set: {
                freezedAt: new Date(),
                freezedBy: adminId,
            },
            $unset: {
                restoredAt: 1,
                restoredBy: 1
            }
        })

        return succsesResponse({
            res,
            info: "Account Freezed Succses",
        })

    }

    unFreezAccountByAdmin = async (req: Request, res: Response): Promise<Response> => {

        const adminId = req.tokenDecoded?._id;
        let { userId } = req.params as unknown as {
            userId :Types.ObjectId
        };

        // UnFreezAccount
        this.unfreezUser(userId)

        return succsesResponse({
            res,
            info: "Account Unfreezed Succses",
        })

    }

    unFreezAccountByAccountAuther = async (req: Request, res: Response): Promise<Response> => {

        const { email, password } = req.body as unknown as {
            email: string,
            password: string
        };

        const user = await this.userModel.findOne({
            filter: {
                email,
                pranoId: false
            }
        });

        if (!user) {
            throw new NotFoundException("User Not Found");
        }

        if (!await compareHash(password, user.password)) {
            throw new BadRequestException("Invalid Email Or Password");
        }

        if (!user.freezedAt && !user.freezedBy) {
            throw new BadRequestException("Account Is Not Freezed");
        }

        if (user.freezedBy &&
            (user.freezedBy.toString() !== user._id.toString())) {
            throw new BadRequestException("Account Is Freezed By Admin");
        }

        const userId = user._id as unknown as Types.ObjectId;

       await this.unfreezUser(userId);

        return succsesResponse({
            res,
            info: "Account Unfreezed Succses",
        })

    }

    deleteAccount = async (req: Request, res: Response): Promise<Response> => {

        const { userId } = req.params;

        const user = await this.userModel.findOne({ filter: { _id: userId } });


        if (!user) {
            throw new NotFoundException("User Not Found")
        }

        if (!user.freezedAt) {
            throw new BadRequestException("Cannot Delete Not Freezed Account");
        }

        const deletedUser = await this.userModel.deleteOne({ _id: userId });

        if (!deletedUser.deletedCount) {
            throw new BadRequestException("Faild To Delete User")
        }

        await deleteFolderByPrefix({ path: `users/${user._id}` });

        return succsesResponse({
            res,
            info: "Account Deleted Succses",
        })

    }

}

export default new UserServise()