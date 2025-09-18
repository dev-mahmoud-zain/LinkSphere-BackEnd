import { Router } from "express";
import { PostService } from "./posts.srevice";
import { authenticationMiddeware, authorizationMiddeware } from "../../middlewares/authentication.middleware";
import { cloudFileUpload, fileValidation, StorageEnum } from "../../utils/multer/cloud.,multer";
import { validationMiddleware } from "../../middlewares/validation.middleware";
import *  as  validation from "./posts.validation";
import { router as commentsRouter } from "../004-comments/index"
import { endPoints } from "./posts.authorization";

const postService = new PostService();

const router = Router();

router.use("/:postId/", commentsRouter)

router.post("/create-post",
    authenticationMiddeware(),
    cloudFileUpload({ validation: fileValidation.image, storageApproach: StorageEnum.disk }).array("attachments", 2),
    validationMiddleware(validation.createPost),
    postService.createPost);

router.patch("/update-post/{:postId}",
    authenticationMiddeware(),
    cloudFileUpload({ validation: fileValidation.image, storageApproach: StorageEnum.disk }).array("attachments", 2),
    validationMiddleware(validation.updatePost),
    postService.updatePost);

router.get("/",
    authenticationMiddeware(),
    validationMiddleware(validation.getPosts),
    postService.getPosts);

router.get("/{:postId}",
    // authenticationMiddeware(), مؤقتاً بس عشان نشوفها من الميل
    validationMiddleware(validation.getPost),
    postService.getPost);

router.post("/like/:postId",
    authenticationMiddeware(),
    validationMiddleware(validation.likePost),
    postService.likePost);


router.delete("/:postId",
    authorizationMiddeware(endPoints.deletePost),
    validationMiddleware(validation.deletePost),
    postService.deletePost);


export default router;