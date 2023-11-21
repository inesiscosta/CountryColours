//Importing the MySQL2 Module
const mysql = require("mysql2");
//Importing the config method from the dotenv module. Allowing the load of environment variables from the .env file
require('dotenv').config();

//Creating the database connection object
const db = mysql.createConnection({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
});

//Connecting to the database
db.connect((err) => {
  if (err) {
    //If an error occurs connecting to the database, log the error to the consule
    console.log("Database connection error:", err);
  } else {
    //If the connection is successful log a success message to the console.
    console.log("MySQL Database Connected");
  }
});

//Exporting the database connection object so it can be used in other modules
module.exports = db;
