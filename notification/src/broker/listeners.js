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
  <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f9f9f9; padding: 40px 0;">
    <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
      
      <div style="background-color: #111827; padding: 20px 30px;">
        <h1 style="color: #ffffff; margin: 0; font-size: 22px;">Payment Successful</h1>
      </div>

      <div style="padding: 30px;">
        <p style="font-size: 16px; color: #111827; margin: 0 0 15px 0;">
          Dear <strong>${data.username}</strong>,
        </p>

        <p style="font-size: 15px; color: #374151; line-height: 1.6;">
          We’ve successfully received your payment of 
          <strong>${data.currency} ${data.amount}</strong> 
          for your order <strong>#${data.orderId}</strong>.
        </p>

        <p style="font-size: 15px; color: #374151; line-height: 1.6;">
          Thank you for your purchase! Your order is now being processed, and we’ll notify you once it’s shipped.
        </p>

        <a href="https://nexora.market/orders/${data.orderId}" 
           style="display: inline-block; margin: 25px 0 10px; background-color: #111827; color: #ffffff; text-decoration: none; 
                  padding: 12px 24px; border-radius: 6px; font-weight: 500;">
          View Your Order
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
            "Payment Successful",
            "We have received your payment",
            emailHTMLTemplate
        );
    });

    subscribeToQueue("PAYMENT_NOTIFICATION.PAYMENT_FAILED", async (data) => {
        const emailHTMLTemplate = `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f9f9f9; padding: 40px 0;">
    <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
      
      <div style="background-color: #dc2626; padding: 20px 30px;">
        <h1 style="color: #ffffff; margin: 0; font-size: 22px;">Payment Failed</h1>
      </div>

      <div style="padding: 30px;">
        <p style="font-size: 16px; color: #111827; margin: 0 0 15px 0;">
          Dear <strong>${data.username}</strong>,
        </p>

        <p style="font-size: 15px; color: #374151; line-height: 1.6;">
          Unfortunately, your payment for order <strong>#${
              data.orderId
          }</strong> could not be processed.
        </p>

        <p style="font-size: 15px; color: #374151; line-height: 1.6;">
          Please try again using a different payment method or contact our support team if the issue persists.
        </p>

        <a href="https://nexora.market/orders/${data.orderId}" 
           style="display: inline-block; margin: 25px 0 10px; background-color: #dc2626; color: #ffffff; text-decoration: none; 
                  padding: 12px 24px; border-radius: 6px; font-weight: 500;">
          Retry Payment
        </a>

        <p style="font-size: 14px; color: #6b7280; margin-top: 25px;">
          Need help? <a href="https://nexora.market/support" style="color: #111827; text-decoration: none; font-weight: 500;">Contact Nexora Support</a>.
        </p>

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
            "Payment Failed",
            "Your payment could not be processed",
            emailHTMLTemplate
        );
    });
};
