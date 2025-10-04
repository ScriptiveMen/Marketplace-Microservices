const { subscribeToQueue } = require("./broker");
const { sendEmail } = require("../email");

module.exports = function () {
    subscribeToQueue("AUTH_NOTIFICATION.USER_CREATED", async (data) => {
        const emailHTMLTemplate = `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f9f9f9; padding: 40px 0;">
    <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
      
      <div style="background-color: #111827; padding: 20px 30px;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Welcome to Nexora</h1>
      </div>

      <div style="padding: 30px;">
        <p style="font-size: 16px; color: #111827; margin: 0 0 15px 0;">
          Dear <strong>${data.fullName.firstName} ${
            data.fullName.lastName || ""
        }</strong>,
        </p>
        
        <p style="font-size: 15px; color: #374151; line-height: 1.6;">
          Thank you for joining <strong>Nexora</strong> — your new home for discovering, buying, and selling unique products in our growing marketplace.
        </p>

        <p style="font-size: 15px; color: #374151; line-height: 1.6;">
          We’re thrilled to have you on board. Start exploring, connecting, and creating opportunities today.
        </p>

        <a href="https://nexora.market" 
           style="display: inline-block; margin: 25px 0 10px; background-color: #111827; color: #ffffff; text-decoration: none; 
                  padding: 12px 24px; border-radius: 6px; font-weight: 500;">
          Visit Nexora
        </a>

        <p style="font-size: 14px; color: #6b7280; margin-top: 25px;">
          Best regards,<br/>
          <strong>The Nexora Team</strong>
        </p>
      </div>

      <div style="background-color: #f3f4f6; padding: 15px 30px; text-align: center; font-size: 12px; color: #9ca3af;">
        © ${new Date().getFullYear()} Nexora Marketplace. All rights reserved.
      </div>

    </div>
  </div>
`;

        await sendEmail(
            data.email,
            "Welcome to Our Service.",
            "Thanks for registering with us!",
            emailHTMLTemplate
        );
    });

    subscribeToQueue("PAYMENT_NOTIFICATION.PAYMENT_COMPLETED", async (data) => {
        const emailHTMLTemplate = `
        <h1>Payment sucessfull </h1>
        <p>Dear ${data.username},</p>
        <p>We have received your payment of ${data.currency} ${data.amount} for order ID: ${data.orderId}. </p>
        <p>Thank you for your purchase!</p>
        <p>Best regards,<br/>The Team</p>
        `;

        await sendEmail(
            data.email,
            "Payment Successful",
            "We have received your payment",
            emailHTMLTemplate
        );
    });

    subscribeToQueue("PAYMENT_NOTIFICATION.PAYMENT_FAILED", async (data) => {
        const emailHTMLTemplate = `
        <h1>Payment Failed</h1>
        <p>Dear ${data.username},</p>
        <p>Unfortunately, your payment for the order ID: ${data.orderId} has failed.</p>
        <p>Please try again or contact support if the issue persists.</p>
        <p>Best regards,<br/>The Team</p>
        `;
        await sendEmail(
            data.email,
            "Payment Failed",
            "Your payment could not be processed",
            emailHTMLTemplate
        );
    });
};
