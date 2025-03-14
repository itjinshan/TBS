const nodemailer = require('nodemailer');

  // email
  const transporter = nodemailer.createTransport({
    service: "SendinBlue",
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAILPASS, 
    }
  });

  module.exports = function ConfirmationEmail(firstName, lastName, email){
    console.log(process.env.email);
    console.log(process.env.password);
    var html = `<body> 
            <div>
            <div height:100px;"> 
            <img src="cid:logo" alt="Smiley face" height="100" width="100" style="display: block;margin-left: auto;margin-right: auto;" />
            </div>
            <div style="  margin: auto;  width: 50%;  width:500px">
            <h1>Trip Confirmation</h1>
            <h4>Dear ${firstName} ${lastName}</h4>
            <h4>Thank you for choosing BAT Tactical</h4>
            <p>Your class has been booked successfully, we are looking forward to see you soon!</p>
            <p>You can view your classes under [Profile] > [Course History]</p>
            <p></p>
            <p>To explore more classes and manage your booking, use our official website: <a href="http://localhost:3000/login">www.battactical.com </a></p>
            <p />
            <p>BAT Tactical</p>
            </div>
            </div>
            </body>`;
      var mailOptions = {
        from: '"Eazigo" <Eazigo@gmail.com>',
        to: `${email}`,
        subject: `Trip Confirmation`,
        attachments: [
          {
            filename: "logo.png",
            path: __dirname + "../Images/Eazigo_Logo.jpg",
            cid: "logo"
          }
        ],
        html: `${html}`
      };
      transporter.sendMail(mailOptions, function(error, info) {
        if (error) {
          console.log(error);
        } else {
          console.log("Email sent: " + JSON.stringify(info));
        }
      });
  }