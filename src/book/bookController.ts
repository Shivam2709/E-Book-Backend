import path from "node:path";
import fs from "node:fs";
import { Request, Response, NextFunction } from "express";
import cloudinary from "../config/cloudinary";
import createHttpError from "http-errors";
import bookModel from "./bookModel";
import { AuthRequest } from "../middlewares/authenticate";

//#region Create Book
/**
 * Controller function to create a new book.
 * Handles file uploads for cover image and book file, uploads them to Cloudinary,
 * and saves the book details in the database.
 * 
 * @param {Request} req - Express request object, contains book details and files.
 * @param {Response} res - Express response object, used to send responses.
 * @param {NextFunction} next - Express next middleware function, used for error handling.
 */
const createBook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, genre, description } = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] }; // for type in the typeScript for file data from milter.

    // Ensure cover image is provided
    if (!files.coverImage || files.coverImage.length === 0) {
      return next(createHttpError(400, "Cover image is required."));
    }
    // Get cover image details
    // MimeTypeArray = application/pdf
    const coverImageMimeType = files.coverImage[0].mimetype.split("/").at(-1);
    const fileName = files.coverImage[0].filename;
    const filePath = path.resolve(
      __dirname,
      "../../public/data/uploads",
      fileName
    );

    // Upload cover image to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(filePath, {
      filename_override: fileName,
      folder: "book-covers",
      format: coverImageMimeType,
    });

    // Ensure book file is provided
    if (!files.file || files.file.length === 0) {
      return next(createHttpError(400, "Book file is required."));
    }

    // Get book file details
    const bookFileName = files.file[0].filename;
    const bookFilePath = path.resolve(
      __dirname,
      "../../public/data/uploads",
      bookFileName
    );

    // Upload book file to Cloudinary
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

    // Create new book record in database
    const newBook = await bookModel.create({
      title,
      description,
      genre,
      author: _req.userId,
      coverImage: uploadResult.secure_url,
      file: bookFileUploaderResult.secure_url,
    });

    // Delete temporary files from server
    await fs.promises.unlink(filePath);
    await fs.promises.unlink(bookFilePath);

    res.status(201).json({ id: newBook._id });
  } catch (err) {
    console.log(err);
    return next(createHttpError(500, "Error while uploading the files."));
  }
};

//#region Update Book
/**
 * Controller function to update an existing book.
 * Handles file uploads for updated cover image and book file, uploads them to Cloudinary,
 * and updates the book details in the database.
 * 
 * @param {Request} req - Express request object, contains updated book details and files.
 * @param {Response} res - Express response object, used to send responses.
 * @param {NextFunction} next - Express next middleware function, used for error handling.
 */
const updateBook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, genre, description } = req.body;
    const bookId = req.params.bookId;

    // Find book by ID
    const book = await bookModel.findOne({ _id: bookId });

    if (!book) {
      return next(createHttpError(404, "Book not found."));
    }

    const _req = req as AuthRequest;
    if (book.author.toString() !== _req.userId) {
      return next(createHttpError(403, "You cannot update another's book."));
    }

    const coverFileSplits = book.coverImage.split("/");
    const coverImagePublicId =
      coverFileSplits.at(-2) + "/" + coverFileSplits.at(-1)?.split(".").at(-2);

    const bookFileSplits = book.file.split("/");
    const bookFilePublicId =
      bookFileSplits.at(-2) + "/" + bookFileSplits.at(-1);

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    let completeCoverImage = book.coverImage;
    let completeFileName = book.file;

    // Handle cover image update
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
      // Upload new cover image to Cloudinary
      const uploadResult = await cloudinary.uploader.upload(filePath, {
        filename_override: filename,
        folder: "book-covers",
        format: coverMimeType,
      });

      completeCoverImage = uploadResult.secure_url;
      await fs.promises.unlink(filePath);
    }

    // Handle book file update
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

      // Upload new book file to Cloudinary
      const uploadResultPdf = await cloudinary.uploader.upload(bookFilePath, {
        resource_type: "raw",
        filename_override: bookFileName,
        folder: "book-pdfs",
        format: "pdf",
      });

      completeFileName = uploadResultPdf.secure_url;
      await fs.promises.unlink(bookFilePath);
    }

    // Update book record in database
    const updatedBook = await bookModel.findOneAndUpdate(
      { _id: bookId },
      {
        title,
        genre,
        description,
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

//#region List Of All Books
/**
 * Controller function to list all books.
 * Retrieves all books from the database and sends them in the response.
 * 
 * @param {Request} req - Express request object.
 * @param {Response} res - Express response object, used to send responses.
 * @param {NextFunction} next - Express next middleware function, used for error handling.
 */
const ListBooks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const book = await bookModel.find();
    res.json(book);
  } catch (err) {
    return next(createHttpError(500, "Error while getting a book."));
  }
};

//#region Get A single Book
/**
 * Controller function to get a single book by ID.
 * Retrieves the book from the database and sends it in the response.
 * 
 * @param {Request} req - Express request object, contains book ID in params.
 * @param {Response} res - Express response object, used to send responses.
 * @param {NextFunction} next - Express next middleware function, used for error handling.
 */
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

//#region Delete Book.
/**
 * Controller function to delete a book by ID.
 * Deletes the book record from the database and removes associated files from Cloudinary.
 * 
 * @param {Request} req - Express request object, contains book ID in params.
 * @param {Response} res - Express response object, used to send responses.
 * @param {NextFunction} next - Express next middleware function, used for error handling.
 */
const deleteBook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bookId = req.params.bookId;

    const book = await bookModel.findOne({ _id: bookId });

    if (!book) {
      return next(createHttpError(404, "Book not found."));
    }

    const _req = req as AuthRequest;
    if (book.author.toString() !== _req.userId) {
      return next(createHttpError(403, "You can not update other book."));
    }

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
