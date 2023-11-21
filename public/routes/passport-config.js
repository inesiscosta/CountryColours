//Importing the required modules
const LocalStrategy = require('passport-local').Strategy;
const db = require("./db-config"); //Importing the database configuration and connection
const bcrypt = require("bcrypt");

//Creating a function to initialize passport authentication
function initialize(passport) {
  const authenticateUser = (email, password, done) => {
    //Querying the database to find a user with the matching email
    db.query(
      'SELECT * FROM user_login WHERE email = ?',[email],
      (err, results) => {
        if (err) {
          console.log("Query error:", err);
          return done(err);
        }

        //If a user is found, comparing the ptovided password with the stored hased password using bcrypt
        if (results.length > 0) {
          const user = results[0];

          bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
              console.log("bcrypt error:", err);
              return done(err);
            }
            // If the password matches, return the user object
            if (isMatch) {
              return done(null, user);
            } else {
              //If the password doesn't match return an error message
              return done(null, false, { message: "Password is incorrect" });
            }
          });
        } else {
          return done(null, false, {
            //If no user is found with the matching email, return an error message
            message: "Email not registered. Sign up?"
          });
        }
      }
    );
  };

  //Using the LocalStrategy to authenticate users
  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      authenticateUser
    )
  );

  //Serializing the user object into the session
  passport.serializeUser((user, done) => done(null, user.email));

  //Deserualizing the user object from the session
  passport.deserializeUser((email, done) => {
    //Querying the database to find a user with the matching email
    db.query('SELECT * FROM user_login WHERE email = ?', [email], (err, results) => {
      if (err) {f
        console.log("Query error:", err);
        return done(err);
      }
      if (results.length > 0) {
        const user = results[0];
        //If a user is found return the user object
        return done(null, user, user.id_login);
      } else {
        // If no user is found, return an error message
        return done (null, false, {message: "User not found"})
      }
    });
  });
}

//Export the initialize function
module.exports = initialize;
