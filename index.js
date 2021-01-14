// Dependencies
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const vision = require("@google-cloud/vision");
const client = new vision.ImageAnnotatorClient();
const bcrypt = require("bcrypt");
const fsPromises = fs.promises;
const uuidv4 = require("uuid").v4;
require("dotenv").config();

// Init app
const app = express();
const PORT = process.env.PORT || 3000
app.use(express.json());

// Mount static route
app.use("/public", express.static("public"));

// Checking File Type
const fileFilter = (req, file, cb) => {
  // Allowed extensions
  const extensions = [".jpg", ".jpeg", ".png", ".gif"];

  // Valid extension flag
  const isValidExtension = extensions.includes(
    path.extname(file.originalname).toLowerCase()
  );

  // Allowed mime types
  const mimetypes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];

  // Valid mimetype flag
  const isValidMimetype = mimetypes.includes(file.mimetype);

  cb(null, isValidMimetype && isValidExtension);
};

// Set storage engine
const storage = multer.diskStorage({
  // Return the path where images are saved
  destination: function (req, file, cb) {
    cb(null, "./public/uploads/");
  },

  // File name generation
  filename: (req, file, cb) => {
    const fileName = uuidv4();
    cb(null, `${fileName}${path.extname(file.originalname).toLowerCase()}`);
  },
});

// Init upload
const upload = multer({
  storage,
  fileFilter,
});

// Set in-memory storage engine for SEARCH BY IMAGE feature
const searchStorage = multer.memoryStorage();
const searchUpload = multer({ storage: searchStorage, fileFilter: fileFilter });



// Create a hashmap that functions as our image database
// The key is the fileName of the image,
// The value is a string containing the path of the image and the array of keywords of corresponding image

/**
 * This serves as our in-memory database indexed by file name.
 * @type {Object.<string, {filePath: string, keywords: Array<string>, passwordEnabled: boolean, passwordHash: string}>}
 */

const database = {};

// Create a hashmap that functions as our keyword database.
// The key is an image keyword and the value is an array of image names that contain such keyword
// This database is mainly used for implementing a fast SEARCH BY IMAGE feature.
// Upon search by image, we generate keywords for the search query imege.
// Then, using these keywords, we fetch similar images containing the keyword from this database.

/**
 * This serves as our in-memory keyword database indexed by keyword and maps to images that contain such keyword .
 * @type {Object.<string, { uuids: Array<string>}>}
 */
const keywordDatabase = {};

// Init a GET request to the server
app.get("/", (req, res) => {
  res.send("Welcome to the image repository of Arya!");
});

/**
 * SEARCH functionality (GET request).
 * returns an array of image paths such that the images share similarities with the search query.
 */

app.get("/search/:name", (req, res) => {
  // Get search query
  const queryName = req.params.name.toLowerCase();
  // Fetch all images that are named as query or contain query as a keyword (sharing similarities)
  const result = Object.keys(database).reduce((acc, cur) => {
    if (
      database[cur] == database[queryName] ||
      database[cur].keywords.includes(queryName)
    ) {
      acc.push(`/${database[cur].filePath}`);
    }
    return acc;
  }, []);
// Return all relevant image paths
  res.json(result);
});


/**
 * SEARCH BY IMAGE functionality (POST request).
 * returns an array of image paths such that the images share similarities with the search query image.
 */

app.post("/search/", searchUpload.single("myImage"), async (req, res) => {
  try {
    // Upload image
    if (!req.file) {
      throw Error("Please select an image file");
    } else {
      // Generate keywords through google cloude api
      const [result] = await client.labelDetection(req.file.buffer);
      const keywords = result.labelAnnotations.map((label) =>
        label.description.toLowerCase()
      );

      // Fetch all images with the same keywords
      const images = keywords.reduce((acc, keyword) => {
        if (keywordDatabase[keyword]) {
          keywordDatabase[keyword].uuids.forEach((uuid) => {
            // For all keywords in file.keywords return accumulator of hashmap[keyword]
            if (!acc.includes(database[uuid].filePath)) {
              acc.push(`${database[uuid].filePath}`);
            }
          });
        }
        return acc;
      }, []);
      // Return all relevant image paths
      res.json(images);
    }
  } catch (e) {
    // Send error status
    res.json({ error: true, message: e.message });
  }
});

//ADD functionality (POST request)

// async-await -> i will wait for you to finish and not pass a callback, and you return result as a variable
// promise -> give me a function and i will pass the result to your function, continue execution outside
// Check if the file in request is an image file, if so upload it to storage destination
// Proceed to generate an array of image keywords using Google CloudVision API
// If all successful, save the image to the database as the following key - value pair:
// {key = image name without extension, value = image path in storage, image keywords}

app.post("/add", upload.single("myImage"), async (req, res) => {
  try {
    // Check if there is a req.file
    // req.file is undefined if there is no file in the request or the file is not an image (removed by fileFilter)
    if (!req.file) {
      throw Error("Please select an image file! (jpeg, jpg, png, gif)");
    } else {
      // Create path string
      const filePath = req.file.path;

      // Generate keywords using Google CloudVision API
      const [result] = await client.labelDetection(filePath);
      const keywords = result.labelAnnotations.map((label) =>
        label.description.toLowerCase()
      );

      console.log(keywords);

      // Extract image file name without extension
      const fileName = path.parse(req.file.path).name;

      // Save the image to the database
      database[fileName] = {
        filePath,
        // Set a password if enabled
        passwordEnabled: !!req.body.password,

        // Hash the password 5 sandrounds for security
        passwordHash: !req.body.password
          ? null
          : await bcrypt.hash(req.body.password, 5),

       // Add image keywords including autogenerated labels and  its original name for better search results
        keywords: [
          ...new Set([
            ...keywords,
            path.parse(req.file.originalname).name.toLowerCase(),
          ]).keys(),
        ],
      };

      // Map image name to each of its keywords in the keyword database
      database[fileName].keywords.forEach((keyword) => {
        if (keywordDatabase[keyword]) {
          keywordDatabase[keyword].uuids.push(fileName);
        } else {
          keywordDatabase[keyword] = { uuids: [fileName] };
        }
      });

      // Send succesful upload message and end response
      res.json({
        message: "File Uploaded",
        passwordEnabled: database[fileName].passwordEnabled,
        fileName,
        filePath: `/${filePath}`,
        keywords: database[fileName].keywords,
      });
    }
  } catch (e) {
    // Send error status
    res.json({ error: true, message: e.message });
  }
});

// DELETE functionality (DELETE request)
// If the request body has the key 'name' as a String,
// proceed to delete corresponding image from database and storage

app.delete("/delete", async (req, res) => {
	try {
		// Verify req.body.name is a string
		if (typeof req.body.name !== "string") {
			throw Error("Type of parameters incorrect");
		}
		const fileName = req.body.name;

		// Check an image with this name exists in the database 
		if (!database[fileName]) {
			throw Error("No such file found.");
		}

		// Check that the user has supplied a password if one is needed
		if (database[fileName].passwordEnabled && !req.body.password) {
			throw Error("Please enter a password");
		}

		// Check if request has a password and if it matches database password
		if (database[fileName].passwordEnabled) {

      // compare hashed passwords

			const validPassword = await bcrypt.compare(
				req.body.password,
				database[fileName].passwordHash
			);

			if (!validPassword) {
				throw Error("Wrong Password!");
			}
		}
    // If all successful, delete image from storage
		await fsPromises.unlink(database[fileName].filePath);

		// Remove image name from all keywordDatabase keys
		database[fileName].keywords.forEach((key) => {
			keywordDatabase[key].uuids = keywordDatabase[key].uuids.filter(
				(uuid) => uuid !== fileName
			);
		});

		// Remove image from database
		delete database[fileName];

		console.log(keywordDatabase);
    console.log(database);
    
    // Send confirmation
		res.json({ message: "image has been deleted successfully" });
	} catch (e) {
		res.json({ error: true, message: e.message });
	}
});

app.listen(PORT, () => {
  console.log(`Example app listening at http://localhost:${PORT}`);
});
