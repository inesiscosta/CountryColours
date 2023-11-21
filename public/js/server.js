//Importing modules
const express = require("express");
const db = require("./routes/db-config");
const passport = require("passport");
const initializePassport = require("./routes/passport-config");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const flash = require("express-flash");
const session = require("express-session");
const path = require('path');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
require("dotenv").config();

//Initalizing the app
const app = express();
const PORT = 3200;

//Set up public directory
app.use(express.static(__dirname + '/public'));

//Middleware for parsing request bodies
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

//Setting up view engine
const { render } = require("ejs");
app.set("view engine", "ejs");

//Setting up session middleware
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {secure: false}
    })
);

//Initializing passport
initializePassport(passport);
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

//Setting up routes
app.get("/", (req, res) => {
    res.render("index");
});

app.get("/work", (req, res) => {
    res.render("work");
});

app.get("/services", (req, res) => {
    res.render("services");
});

app.get("/about", (req, res) => {
    res.render("about");
});

app.get("/users/contact", checkNotAuthenticated, (req, res) => {
  res.render("contact")
});

app.get("/users/consultation", checkNotAuthenticated, (req, res) => {
  res.render("consultation", { message: "" });
});

//Soute for handling forgot password page
app.get("/users/forgot-password", (req, res, next) => {
    res.render("forgot-password", { message: "" });
});

//Route for handling the submission of the forgot password form
app.post('/users/forgot-password', (req, res, next) => {
    const email = req.body.email;
    //Checking if the email exists in the database
    db.query('SELECT COUNT(*) AS count from user_login WHERE email = ?;', [email], (err, result, fields) => {
      if (err) {
        console.error(err);
        res.render("forgot-password", { message: "An error occurred while processing your request." });
        return;
      }
      const count = result[0].count;
      if (count > 0) {
        //Generating a password reset token and sending an email to user with link to reset password
        db.query('SELECT id_login, password FROM user_login WHERE email=?', [email], (err, results) => {
          if (err) {
            console.error(err);
            res.render("forgot-password", { message: "An error occurred while processing your request." });
            return;
          }
          if (results.length === 0) {
            console.log("No row found for email:", email);
            res.render("forgot-password", { message: "No user found with that email address." });
            return;
          }
          const password = results[0].password;
          const id_login = results[0].id_login;
          const secret = process.env.JWT_SECRET + password;
          const payload = {
            email: email,
            id_login: id_login
          };
          const token = jwt.sign(payload, secret, { expiresIn: '15m' })
          const link = `http://localhost:4800/reset-password/${id_login}/${token}`

          //Sending the email using nodemailer
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: 'info.countrycolours@gmail.com',
              pass: 'aiuhmlftemjasyra'
            }
          });
  
          const mailOptions = {
            from: 'info.countrycolours@gmail.com',
            to: email,
            subject: 'Password Reset Link for your Country Colours Account',
            text: `Here's your password reset link: ${link}`
          };
  
          transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
              console.log(error);
              res.render("forgot-password", { message: "An error occurred while processing your request." });
            } else {
              res.render("forgot-password", { message: "Password reset link has been sent to your email." }); 
            }
          });
        });
      } 
      //If the email doesn't exist in the database render the forgot password view with an error message
      else {
        res.render("forgot-password", { message: "Email not registered." });
      }
    });
});

app.get('/reset-password/:id_login/:token', (req, res, next) => {
  //Extracting the id_login and token from the request parameters
  const { id_login, token } = req.params;
  //Querying the database for the user with the given id_login to retrieve their email and password
  db.query('SELECT email, password FROM user_login WHERE id_login=?', [id_login], (err, results) => {
    if (err) {
      console.error(err);
      res.status(404).send("Invalid reset password link.");
      return;
    }
    if (results.length === 0) {
      console.log("No row found for id_login:", id_login);
      res.status(404).send("Invalid reset password link.");
      return;
    }
    //If a user is found with the given id_login, retrieve their email and password from the query results
    const email = results[0].email;
    const password = results[0].password;
    //Creating a secret string by concatenating the JWT_SECRET and user's password
    const secret = process.env.JWT_SECRET + password;
    //Verifying the token using the secret
    try {
      const payload = jwt.verify(token, secret)
      //If the token is valid, render the reset-password page with the user's email
      res.render('reset-password', { email: email })
    } catch (error) {
      //If the token is invalid, log the error and render the reset-password page with an error message
      console.error(error.message);
      res.status(400).render('reset-password', { error: error.message });
    }
  });
});

//Route handling the reset of the users password
app.post('/reset-password/:id_login/:token', async (req, res, next) => {
  const { id_login, token } = req.params;
  const { password1, password2 } = req.body;
  try {
    const results = await new Promise((resolve, reject) => {
      //Retrieve the email and password of the user from the id_login
      db.query('SELECT email, password FROM user_login WHERE id_login=?', [id_login], (error, results) => {
        if (error) {
          reject(error);
        } else {
          resolve(results);
        }
      });
    });
    const password = results[0].password;
    //Using the retrieved password as a secret to verify the tokem
    const secret = process.env.JWT_SECRET + password;
    if (password1 !== password2) {
      res.status(400).send('Passwords do not match.');
      return;
    }
    if (password1.length < 8 || password2.length < 8) {
      res.status(400).send('The new password must be at least 8 characters long.');
      return;
    }

    //If the new password is valid. Hash the password and store it in the database
    const hashedPassword = await bcrypt.hash(password1, 10);
    await new Promise((resolve, reject) => {
      db.query('UPDATE user_login SET password = ? WHERE id_login = ?', [hashedPassword, id_login], (error, results) => {
        if (error) {
          reject(error);
        } else {
          resolve(results);
          res.render("login", {message: "Password reset. You can now login."});
        }
      });
    });
    res.render('reset-password', { success: true });
  } catch (error) {
    res.status(400).send(error.message);
  }
});

//Route to display the job status to authenticated users
app.get('/users/status', checkNotAuthenticated, (req, res) => {
  //Querying the database for the id_login associated with the user's email
    db.query('SELECT id_login FROM user_login WHERE email = ?', [req.user.email], (err, results) => {
      if (err) throw err;
      //Geting the id:login value from the query results
      const id_login = results[0].id_login;
      //Querying the job_status table for the user's job status records
      db.query('SELECT * FROM job_status WHERE id_login = ?', [id_login], (err, results) => {
        if (err) throw err;
        const user = results[0];
        //Rendering the status page and passing in the job status data and user information
        res.render('status', { data: results, user: user });
      });
    });
});

//Handles POST requests to the users/consultation route.
app.post("/users/consultation", checkNotAuthenticated, (req, res) => {
  //Extracting data from the request body
    const address = req.body.address;
    const date = req.body.date;
    const id_login = req.user.id_login;
    //Inserting a new record to the job_status table in the database with the extracted data
    db.query('INSERT INTO job_status (id_login, address, consultation_date) VALUES (?, ?, ?)', [id_login, address, date], (err, results) => {
        if (err) throw err;
        //Rendering the consultation view with a success message
        res.render("consultation", { message: "Consultation scheduled." });
    });
});

//Route renders the user's profile page.
//The 'checkNotAuthenticated' middleware is used to ensure that only authenticated users can access this page.
app.get("/users/profile", checkNotAuthenticated, (req, res) => {
  //Retrieving user info from the user_login table in the database based on their email.  
  db.query("SELECT * FROM user_login WHERE email = ?", [req.user.email], (err, results) => {
      if (err) throw err;
      const user = results[0];
      //Rendering the profile view passing the user object as a parameter.
      res.render("profile", { user });
    });
});
  
app.post("/updateProfile", async (req, res) => {
    const { username, email, password } = req.body;

    let hashedPassword = null;

    //If a new password is provided, validate its length and hash it
    if (password) {
      if (password.length < 8) {
        const errorMessage = "Password must be at least 8 characters long.";
        return res.render("profile", { user:req.user, errorMessage });
      }
      hashedPassword = await bcrypt.hash(password, 10);
    }
    //Otherwise, retrieve the existing hashed password from the database 
    else{
      const user = await new Promise((resolve, reject) => {
        db.query("SELECT * FROM user_login WHERE id_login = ?", [req.user.id_login], (err, results) => {
          if (err) reject(err);
          resolve(results[0]);
        });
      });
      hashedPassword = user.password;
    }
    //Updating the user profile in the database
    const sql = "UPDATE user_login SET username = ?, email = ?, password = ? WHERE id_login = ?";
    db.query(sql, [username, email, hashedPassword, req.user.id_login], (err, results) => {
      if (err) {
        throw err;
      }
    });
});


app.get("/users/register", checkAuthenticated, (req, res) => {
    res.render("register", {message:""});
});

//Rendering the login page with an error message if there is one
app.get("/users/login", checkAuthenticated, (req, res) => {
    if (req.session.flash && req.session.flash.error) {
        console.log(req.session.flash.error);
    }
    res.render("login", {message:""});
});

//Rendering the dashboard page if the user is authenticated
app.get("/users/dashboard", checkNotAuthenticated, (req, res) => {
    console.log(req.isAuthenticated());
    res.render("dashboard", { user: req.user.username });
});

//Loging the user out and redirecting them to the home page
app.get('/users/logout', function(req, res, next) {
    req.logout(function(err) {
        if (err) {return next(err);}
        res.redirect("/")
    }); 
});

//Handling a POST request to the /users/register endpoint
app.post("/users/register", async (req, res) => {
    //Destructuring the relevant fields from the request body
    let { username, email, password, password2, birthdate } = req.body;
    //Initializing an empty array to hold validation errors
    let errors = [];

    // Validating that the username, email, password, password2, and birthdate fields have been entered
    if (!username) {
        errors.push({ message: "Please enter a username." });
    }
    if (!email) {
        errors.push({ message: "Please enter an email." });
    }
    if (!password) {
        errors.push({ message: "Please enter a password." });
    }
    if (!password2) {
        errors.push({ message: "Please re-enter your password." });
    }
    if (!birthdate) {
        errors.push({message: "Please enter your date of birth."})
    }
    //Validating that the password is at least 8 characters long
    if (password.length < 8) {
        errors.push({ message: "The password must be at least 8 characters long." });
    }
    //Validating that the password and password2 fields match
    if (password != password2) {
        errors.push({ message: "Passwords do not match." });
    } 
    //If there are any validation errors, render the "register" view with the error messages
    if (errors.length > 0) {
        res.render("register", { errors, username, email, password, password2, birthdate });
    } 
    //Otherwise hash the password and check if the email is already registered
    else {
        hashedPassword = await bcrypt.hash(password, 10);

        db.query('SELECT * FROM user_login WHERE email = ?', [email], function(err, results){
                if (err) {
                    console.log(err);
                }
                if (results.length > 0) {
                    return res.render("register", {
                        message: "Email already resgistered. Please provide a different email or login."
                    });
                } 
                //If the email is not already registered, add the user into the database and redirect him to the login page
                else {
                    db.query('INSERT INTO user_login SET ?', {username: username, email: email, password: hashedPassword, birthdate: birthdate}, (err, results) => {
                            if (err) {
                                throw err;
                            }
                            req.flash("success_msg", "You are now registered and can login.");
                            res.redirect("/users/login");
                        }
                    );
                }
            }
        );
    }
});

//Handling a POST request to the "/users/login" endpoint using passport authentication
app.post("/users/login",
    passport.authenticate("local", {
        successRedirect: "/users/dashboard",
        failureRedirect: "/users/login",
        failureFlash: true
    })
);

//Middleware function to check if the user is authenticated. If so, redirect to the dashboard
function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return res.redirect("/users/dashboard");
    }
    next();
}

//Middleware function to check if the user is not authenticated. If so, redirect to the login page
function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect("/users/login");
}


app.post("/users/contact", (req, res) => {
  //Destructuring the relevant fields from the request body
    let { name, email, subject, message } = req.body;

    //Creating a nodemailer transporter that will send the email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
          user: "info.countrycolours@gmail.com",
          pass: "aiuhmlftemjasyra"
      },
      tls: {
          rejectUnauthorized: false
      }
    });
  
    //Specifying the email options
    const mailOptions = {
      from: email,
      to: 'info.countrycolours@gmail.com',
      subject: `Message from ${name}: ${subject}`,
      text: `${message}. Email user back about his message at ${email}`
    };

    //Sending the email
    transporter.sendMail(mailOptions, (error, info) => {
      //If there is an error, log it and send an error response
      if (error) {
        console.log(error);
        res.send("error");
      } else {
        //Otherwirse, send a success response
        res.send("success");
      }
    });
});  

//Starting the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
