import path from "node:path";
import fs from "node:fs";
import { Request, Response, NextFunction } from "express";
import cloudinary from "../config/cloudinary";
import createHttpError from "http-errors";
import bookModel from "./bookModel";
import { AuthRequest } from "../middlewares/authenticate";

const createBook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, genre } = req.body;

    // upload coverImage in Cloudinary using multer
    const files = req.files as { [fieldname: string]: Express.Multer.File[] }; // for type in the typeScript for file data from milter.

    if (!files.coverImage || files.coverImage.length === 0) {
      return next(createHttpError(400, "Cover image is required."));
    }

    // MimeTypeArray = application/pdf
    const coverImageMimeType = files.coverImage[0].mimetype.split("/").at(-1);
    const fileName = files.coverImage[0].filename;
    const filePath = path.resolve(
      __dirname,
      "../../public/data/uploads",
      fileName
    );

    const uploadResult = await cloudinary.uploader.upload(filePath, {
      filename_override: fileName,
      folder: "book-covers",
      format: coverImageMimeType,
    });

    if (!files.file || files.file.length === 0) {
      return next(createHttpError(400, "Book file is required."));
    }

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

    // @ts-ignore
    // console.log("userId", req.userId);

    const _req = req as AuthRequest;

    const newBook = await bookModel.create({
      title,
      genre,
      author: _req.userId,
      coverImage: uploadResult.secure_url,
      file: bookFileUploaderResult.secure_url,
    });

    // Delete temp files.
    await fs.promises.unlink(filePath);
    await fs.promises.unlink(bookFilePath);

    res.status(201).json({ id: newBook._id });
  } catch (err) {
    console.log(err);
    return next(createHttpError(500, "Error while uploading the files."));
  }
};

const updateBook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, genre } = req.body;
    const bookId = req.params.bookId;

    const book = await bookModel.findOne({ _id: bookId });

    if (!book) {
      return next(createHttpError(404, "Book not found."));
    }

    // Check access
    const _req = req as AuthRequest;
    if (book.author.toString() !== _req.userId) {
      return next(createHttpError(403, "You cannot update another's book."));
    }

    // Get Cloudinary Public Ids
    const coverFileSplits = book.coverImage.split("/");
    const coverImagePublicId =
      coverFileSplits.at(-2) + "/" + coverFileSplits.at(-1)?.split(".").at(-2);

    const bookFileSplits = book.file.split("/");
    const bookFilePublicId =
      bookFileSplits.at(-2) + "/" + bookFileSplits.at(-1);

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    let completeCoverImage = book.coverImage;
    let completeFileName = book.file;

    // Upload new cover image if provided and delete old one
    if (files && files.coverImage) {
      const filename = files.coverImage[0].filename;
      const coverMimeType = files.coverImage[0].mimetype.split("/").at(-1);
      const filePath = path.resolve(
        __dirname,
        "../../public/data/uploads",
        filename
      );

      // Delete old cover image from Cloudinary
      if (coverImagePublicId) {
        await cloudinary.uploader.destroy(coverImagePublicId);
      }

      const uploadResult = await cloudinary.uploader.upload(filePath, {
        filename_override: filename,
        folder: "book-covers",
        format: coverMimeType,
      });

      completeCoverImage = uploadResult.secure_url;
      await fs.promises.unlink(filePath);
    }

    // Upload new book file if provided and delete old one
    if (files && files.file) {
      const bookFilePath = path.resolve(
        __dirname,
        "../../public/data/uploads",
        files.file[0].filename
      );
      const bookFileName = files.file[0].filename;

      // Delete old book file from Cloudinary
      if (bookFilePublicId) {
        await cloudinary.uploader.destroy(bookFilePublicId, {
          resource_type: "raw",
        });
      }

      const uploadResultPdf = await cloudinary.uploader.upload(bookFilePath, {
        resource_type: "raw",
        filename_override: bookFileName,
        folder: "book-pdfs",
        format: "pdf",
      });

      completeFileName = uploadResultPdf.secure_url;
      await fs.promises.unlink(bookFilePath);
    }

    const updatedBook = await bookModel.findOneAndUpdate(
      { _id: bookId },
      {
        title,
        genre,
        coverImage: completeCoverImage,
        file: completeFileName,
      },
      { new: true }
    );

    res.json(updatedBook);
  } catch (err) {
    return next(createHttpError(500, "Error while updating records."));
  }
};

const ListBooks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // todo add pagination.
    const book = await bookModel.find();
    res.json(book);
  } catch (err) {
    return next(createHttpError(500, "Error while getting a book."));
  }
};

const getSingleBook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const bookId = req.params.bookId;

  try {
    const book = await bookModel.findOne({ _id: bookId });

    if (!book) {
      return next(createHttpError(404, "Book not found."));
    }
    return res.json(book);
  } catch (err) {
    return next(createHttpError(500, "Error while getting a book."));
  }
};

const deleteBook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bookId = req.params.bookId;

    const book = await bookModel.findOne({ _id: bookId });

    if (!book) {
      return next(createHttpError(404, "Book not found."));
    }

    // check access
    const _req = req as AuthRequest;
    if (book.author.toString() !== _req.userId) {
      return next(createHttpError(403, "You can not update other book."));
    }

    // get cloudinary Public Id :- book-cover/dghynghbtjyj

    const coverFileSpltes = book.coverImage.split("/");
    const coverImagePublicId =
      coverFileSpltes.at(-2) + "/" + coverFileSpltes.at(-1)?.split(".").at(-2);
    console.log("coverImagePublicId", coverImagePublicId);

    const bookFileSplits = book.file.split("/");
    const bookFilePublicId =
      bookFileSplits.at(-2) + "/" + bookFileSplits.at(-1);

    console.log("bookFilePublicId", bookFilePublicId);

    try {
      await cloudinary.uploader.destroy(coverImagePublicId);
      await cloudinary.uploader.destroy(bookFilePublicId, {
        resource_type: "raw",
      });
    } catch (err) {
      return next(
        createHttpError(500, "Error deleting files from Cloudinary.")
      );
    }

    // Delete the book record from the database
    try {
      await bookModel.deleteOne({ _id: bookId });
    } catch (dbError) {
      console.error("Error deleting book from database:", dbError);
      return next(createHttpError(500, "Error deleting book from database."));
    }

    return res
      .status(201)
      .json({ _id: bookId, message: "Book deleted successfully." });
  } catch (err) {
    next(createHttpError(500, "An unexpected error occurred."));
  }
};

export { createBook, updateBook, ListBooks, getSingleBook, deleteBook };
