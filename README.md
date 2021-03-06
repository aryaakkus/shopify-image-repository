# Shopify Challenge - Image Repository

## Description:

This is the backend for Shopify Backend/ Infrastructure Internship Challenge. I designed an image repository that has the following features:

- Upload an image with the ability to set password
- Search images by keyword or image name
- Search images by another image
- Delete an image with password verification

The technologies utilized in this project were Express, Multer, Uuidv4, Bcrypt and Google Cloud Vision API.

## Installation and Setup Instructions

### Running Locally

Once we have installed Node.js and the project,

Run:

- ``npm install `` on your terminal.

Then, run the server by writing ``node index.js`` on terminal. In these examples, I use ``Postman`` as the HTTP client to send requests to  http://localhost:3000. However, any HTTP client works just as well.

**Running locally works only if a Google Cloud Vision API key is provided.**

### Running on Heroku

**The backend is also hosted on heroku**. Again, I prefer using ``Postman`` as my HTTP client to send requests to [https://arya-image-repo.herokuapp.com/](https://arya-image-repo.herokuapp.com/). **No API key is required for this method.**

## Choice of Database

- For this challenge, I initially planned to use a mongoDB database. However, if I had used a local mongoDB database, every user would have to install mongoDB when running the program. Likewise, if I had used a remote mongoDB database, I would have to pass the access key in the code.

- Thus, for the scope of this challenge, I decided to use an in-memory database for images and another one for keywords for simplicity.

- The image database is designed as a hashmap with the following key-value pair:

{ **key** : fileName, **value:**

    - string filePath in storage,
    - an array of auto-generated relevant keywords,
    - boolean passwordEnabled,
    - string hashed password

} 

The keyword database is needed to implement a fast and efficient `search by image` feature. It

is also designed as a hashmap with the following key-value pair:

{ **key** : string keyword,  **value:** an array of image names containing this keyword }

## Uploading Images

POST ``/add/``

- Request body:

{

 **key** : myImage, **value** : an image file (jpg, jpeg, png, gif),

**key** : password, **value** : a password (text/string) _(optional)_

}

- This feature consists of uploading the image to the destination storage and saving the image in the database. An error is thrown if the requested file is not an image or there is no file in request body. Images are saved **with a unique name consisting of an uuid** and file extension.
- If the image is successfully uploaded in destination, it is then saved in the database.
- If there is a password in the request, the image is saved with passwordEnabled = true.
- The password passed to the request is **saved after being hashed (using bcrypt) for better security**.
- When saving in the database, an image is treated as a key-value pair where the key is the image name (uuid), and the value is:

    - filePath in storage,
    - an array of auto-generated relevant keywords,
    - boolean passwordEnabled,
    - Hashed password

- The image name is also mapped to the corresponding keywords in the keyword database.
- If the image is successfully uploaded and saved, a response with a confirmation message is sent.

### Generating Keywords

- Keywords of an image are generated by the **label detection feature of Google Cloud Vision API.**
- The reason for using auto-generated keywords is to **implement a secure and coherent search functionality** which returns all relevant images to the search query.

### Examples:
- Here, I consecutively added two different cat jpg images with password and another png logo image without password. 
- Then, I attempted sending a requst with no image file and later with a pdf file. Appropriate errors were thrown for these two attempts.

<img src="https://github.com/aryaakkus/shopify-image-repository/blob/master/screenshots/Screen%20Shot%202021-01-13%20at%203.40.47%20PM.png" width="450" height="360"> <img src="https://github.com/aryaakkus/shopify-image-repository/blob/master/screenshots/Screen%20Shot%202021-01-13%20at%203.41.21%20PM.png" width="450" height="360"> <img src="https://github.com/aryaakkus/shopify-image-repository/blob/master/screenshots/Screen%20Shot%202021-01-13%20at%203.42.24%20PM.png" width="450" height="360"> <img src="https://github.com/aryaakkus/shopify-image-repository/blob/master/screenshots/Screen%20Shot%202021-01-13%20at%203.44.57%20PM.png" width="450" height="360"> <img src="https://github.com/aryaakkus/shopify-image-repository/blob/master/screenshots/Screen%20Shot%202021-01-13%20at%203.45.23%20PM.png" width="450" height="360">



## Searching Images

### Search by name or keyword

GET ``/search/:name/``

- Returns an array of paths of selected images from the database
- The path of an image is included in the returned array if:
  - File name of the image is equal to name parameter
  - Keywords of the image contain name (meaning that the image is relevant)

### Search by image

POST ``/search/``

- Request body:

{

**key** : myImage, **value** : an image file (jpg, jpeg, png, gif)

}

- Returns an array of paths of selected images from the database

- The image file in the request is saved in memory storage. Then, keywords for the search image are generated by the **label detection feature of Google Cloud Vision API.**
- Then, all relevant images containing these keywords that are fetched from the keyword database.

- Their paths are returned in an array.

### Examples:
- Here, after my uploads, I search for keyword cat and get the paths of two cat pictures as response. 
- Next, I search for keyword "design" and get the path of the logo image. 
- Then, I search a keyword that does not match anything and get an empty array as result.
- Finally, I search by an image of another cat and get the paths of two cat pictures as response.

<img src="https://github.com/aryaakkus/shopify-image-repository/blob/master/screenshots/Screen%20Shot%202021-01-13%20at%203.45.48%20PM.png" width="450" height="360"> <img src="https://github.com/aryaakkus/shopify-image-repository/blob/master/screenshots/Screen%20Shot%202021-01-13%20at%203.45.59%20PM.png" width="450" height="360"> <img src="https://github.com/aryaakkus/shopify-image-repository/blob/master/screenshots/Screen%20Shot%202021-01-13%20at%203.46.09%20PM.png" width="450" height="360"> <img src="https://github.com/aryaakkus/shopify-image-repository/blob/master/screenshots/Screen%20Shot%202021-01-13%20at%203.46.47%20PM.png" width="450" height="360">


## Deleting Images

DELETE ``/delete/``

- Request body:

{

**key** : name, **value** : an image name,

**key** : password, **value** : a password string _(optional)_

}

- After verifying that the request body has a key &quot;name&quot; (which has a string value), this fuction proceeds to delete the image with such name.
- If such image does not exist, an error is thrown.
- If such image exists and it has no password set, it is deleted immediately from the storage, keyword database and imaga database.
- If such image exists and it has a password set, it is deleted after checking that two passwords match. If the password passed to the request is inexistent or invalid, appropriate errors are thrown.
- If deletion is succesful, a confirmation message is sent.

### Examples:
- First, I successfully delete the logo image that I uploaded without password
- Next, I attempt to delete a password enabled image with a wrong password and get an error.
- Then, I attempt to delete a password enabled image  with no password and get an error.
- Finally,I successfuly delete the password enabled image with the correct password.

<img src="https://github.com/aryaakkus/shopify-image-repository/blob/master/screenshots/Screen%20Shot%202021-01-13%20at%203.48.19%20PM.png" width="500" height="360"> <img src="https://github.com/aryaakkus/shopify-image-repository/blob/master/screenshots/Screen%20Shot%202021-01-13%20at%203.49.20%20PM.png" width="500" height="360"> <img src="https://github.com/aryaakkus/shopify-image-repository/blob/master/screenshots/Screen%20Shot%202021-01-13%20at%203.49.30%20PM.png" width="500" height="360"> <img src="https://github.com/aryaakkus/shopify-image-repository/blob/master/screenshots/Screen%20Shot%202021-01-13%20at%203.49.50%20PM.png" width="500" height="360">



## Reflections

- Multiple (bulk) upload and delete features could be implemented by simply using ``multer.upload.array()`` instead of ``multer.upload.single()``
- Password check can be used in viewing images depending on design choice
