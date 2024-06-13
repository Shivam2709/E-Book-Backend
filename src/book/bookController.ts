import path from "node:path";
import { Request, Response, NextFunction } from "express";
import cloudinary from "../config/cloudinary";
import createHttpError from "http-errors";

const createBook = async (req: Request, res: Response, next: NextFunction) => {
  // console.log('Files', req.files);

  // upload coverImage in Cloudinary using multer
  const files = req.files as { [fieldname: string]: Express.Multer.File[] }; // for type in the typeScript for file data from milter.
  // MimeTypeArray = application/pdf
  const coverImageMimeType = files.coverImage[0].mimetype.split("/").at(-1);
  const fileName = files.coverImage[0].filename;
  const filePath = path.resolve(
    __dirname,
    "../../public/data/uploads",
    fileName
  );

  try {
    const uploadResult = await cloudinary.uploader.upload(filePath, {
      filename_override: fileName,
      folder: "book-covers",
      format: coverImageMimeType,
    });

    // upload book in Cloudinary using multer
    const bookFileName = files.file[0].filename;
    const bookFilePath = path.resolve(
      __dirname,
      "../../public/data/uploads",
      bookFileName
    );

    const bookFileUploaderResult = await cloudinary.uploader.upload(
      bookFilePath,
      {
        resource_type: "raw",
        filename_override: bookFileName,
        folder: "book-pdfs",
        format: "pdf",
      }
    );

    // console.log("Book details", bookFileUploaderResult);

    // console.log('Upload result', uploadResult);

    res.json({});
  } catch (err) {
    console.log(err);
    return next(createHttpError(500, "Error while uploading the files."));
  }
};

export { createBook };
