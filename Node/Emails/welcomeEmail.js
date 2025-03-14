const nodemailer = require('nodemailer');

  // email
  const transporter = nodemailer.createTransport({
    service: "SendinBlue",
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAILPASS, 
    }
  });

  module.exports = function welcomeEmail(FirstName, LastName, Email){
    var html = `<body> 
            <div>
            <div height:100px;"> 
            <img src="cid:logo" alt="Smiley face" height="100" width="100" style="display: block;margin-left: auto;margin-right: auto;" />
            </div>
            <div style="  margin: auto;  width: 50%;  width:500px">
            <h1>Welcome to Eazigo</h1>
            <h4>Dear ${FirstName} ${LastName}</h4>
            <p>Thank you for signning up with Eazigo</p>
            <p />
            <p>Eazigo Support Team </p>
            </div>
            </div>
            </body>`;
      var mailOptions = {
        from: '"Eazigo" <eazigo@gmail.com>',
        to: `${Email}`,
        subject: `Welcome to Eazigo`,
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