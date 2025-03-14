const nodemailer = require('nodemailer');

  // email
  const transporter = nodemailer.createTransport({
    service: "SendinBlue",
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAILPASS, 
    }
  });

  module.exports = function forgotPasswordEmail(Email, resetToken){
    var html = `<body> 
            <div>
            <div height:100px;"> 
            <img src="cid:logo" alt="Smiley face" height="100" width="100" style="display: block;margin-left: auto;margin-right: auto;" />
            </div>
            <div style="  margin: auto;  width: 50%;  width:500px">
            <h1>Please click on the link below and follow the instructions to reset your password.</h1>
            <h4><a href="http://localhost:3000/reset-password?ResetToken=${resetToken}">Reset password link</a></h4>
            <p /p>
            <p>This link will expire in 20 minutes.</p>
            <p />
            <p>Ea </p>
            </div>
            </div>
            </body>`;
      var mailOptions = {
        from: '"Eazigo" <Eazigo@gmail.com>',
        to: `${Email}`,
        subject: `Password Reset Link`,
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