//Selecting the HTML form element with class contact
const contactForm = document.querySelector('.contact');

//Getting the input field element by their IDs
let name = document.getElementById("name");
let email = document.getElementById("email");
let subject = document.getElementById("subject");
let message = document.getElementById("message");
//Getting the HTML element where the status of the email sending will be displayed
let status = document.getElementById("status");

//Adding a submit event listener to the contact form
contactForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    
    //Creating an object with the form data to be sent
    let formData = {
        name: name.value,
        email: email.value,
        subject: subject.value,
        message: message.value
    }
    
    //Creating a new XMLHttpRequest object
    let xhr = new XMLHttpRequest();
    //Setting the request method and endpoint
    xhr.open("POST", "/users/contact");
     //Setting the request header to specify the content type as JSON
    xhr.setRequestHeader("content-type","application/json");
    //Defining what happens when the request is loaded
    xhr.onload = function(){
        //Updating the status element with the appropriate message based on the response
        if(xhr.responseText == "success"){
            status.textContent = "Email Sent. A representative will answer your email shortly.";
            //Resetting the input fields to their initial values
            name.value = "";
            email.value = "";
            subject.value = "";
            message.value = "";
        } else{
            status.textContent = "Something went wrong!";
        }
    }
    //Sending the form data as a JSON string
    xhr.send(JSON.stringify(formData));
})
