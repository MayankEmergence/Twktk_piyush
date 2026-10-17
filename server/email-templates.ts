export interface LoginEmailParams {
  email: string;
  link: string;
  origin: string;
}

export interface TicketEmailParams {
  email: string;
  eventTitle: string;
  city: string;
  venue: string;
  startsAt: string;
  category: string;
  quantity: number;
  admissions: number;
  totalGuests: number;
  amount: number;
  orderId: string;
  ticketIds: string[];
  accountUrl: string;
  origin: string;
}

export function renderLoginEmailHtml({ email, link, origin }: LoginEmailParams): { html: string; text: string } {
  const isSignup = link.includes("verify=signup");
  const isReset = link.includes("reset") || link.includes("forgot");
  const logoUrl = `${origin}/assets/brand/logo.png`;

  let badge = "ACCESS LINK";
  let title = "Enter Your World";
  let subtitle = "Click the button below to sign in to your TWKTK account. This private access link is valid for 15 minutes.";
  let buttonText = "Enter TWKTK →";

  if (isSignup) {
    badge = "VERIFICATION";
    title = "Confirm Your Account";
    subtitle = "Click below to confirm your email and set your access password. This link expires in 15 minutes.";
    buttonText = "Confirm Email →";
  } else if (isReset) {
    badge = "PASSWORD RESET";
    title = "Reset Your Password";
    subtitle = "We received a request to reset your password. Use the link below to access your account and set a new password. If you didn't make this request, you can ignore this email.";
    buttonText = "Reset Password →";
  }

  const plainText = `${title.toUpperCase()}\n\nThose Who Know They Know\n\n${subtitle}\n\nDirect link:\n${link}\n\nThis single-use link expires in 15 minutes.\n\n19.0760°N · 72.8777°E · EMERGENCE`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — TWKTK</title>
</head>
<body style="margin:0;padding:0;background-color:#050507;color:#ffffff;font-family:'IBM Plex Mono',Menlo,Consolas,monospace;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#050507;width:100%;table-layout:fixed;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:500px;background-color:#09090d;border:1px solid #1a1a20;">
          
          <!-- TOP LOGO / LABEL -->
          <tr>
            <td style="padding:36px 36px 28px 36px;border-bottom:1px solid #14141a;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle">
                    <img src="cid:twktk-logo" onerror="this.onerror=null;this.src='${logoUrl}';" alt="TWKTK" width="36" height="36" style="display:block;border:0;width:36px;height:36px;border-radius:50%;" />
                  </td>
                  <td align="right" valign="middle">
                    <div style="font-size:10px;letter-spacing:2px;color:#737380;text-transform:uppercase;">${badge}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:36px 36px 32px 36px;">
              <div style="font-size:11px;letter-spacing:2px;color:#737380;text-transform:uppercase;margin-bottom:12px;">THOSE WHO KNOW THEY KNOW</div>
              <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;letter-spacing:1px;color:#ffffff;text-transform:uppercase;line-height:1.3;">
                ${title}
              </h1>
              <p style="margin:0 0 32px 0;font-size:13px;color:#8f8f9d;line-height:1.7;">
                ${subtitle}
              </p>

              <!-- BUTTON -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
                <tr>
                  <td>
                    <a href="${link}" target="_blank" style="display:inline-block;padding:14px 28px;background-color:#ffffff;color:#050507;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;text-decoration:none;border-radius:1px;">
                      ${buttonText}
                    </a>
                  </td>
                </tr>
              </table>

              <!-- URL FALLBACK -->
              <div style="border-top:1px solid #14141a;padding-top:24px;">
                <div style="font-size:10px;color:#50505e;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Direct link</div>
                <div style="word-break:break-all;font-size:11px;color:#737380;line-height:1.6;">
                  <a href="${link}" target="_blank" style="color:#8f8f9d;text-decoration:none;">${link}</a>
                </div>
              </div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:20px 36px;border-top:1px solid #14141a;background-color:#07070a;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:10px;color:#50505e;letter-spacing:1px;text-transform:uppercase;">
                    19.0760&deg;N &middot; 72.8777&deg;E
                  </td>
                  <td align="right" style="font-size:10px;color:#50505e;letter-spacing:1px;text-transform:uppercase;">
                    EMERGENCE
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { html, text: plainText };
}

export function renderTicketEmailHtml(params: TicketEmailParams): { html: string; text: string } {
  const {
    email,
    eventTitle,
    city,
    venue,
    startsAt,
    category,
    totalGuests,
    amount,
    orderId,
    ticketIds,
    accountUrl,
    origin,
  } = params;

  const logoUrl = `${origin}/assets/brand/logo.png`;
  const formattedDate = new Date(startsAt).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
  const formattedAmount = (amount / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });

  const plainText = `CONFIRMED TICKETS — TWKTK\n\nEvent: ${eventTitle}\nCity: ${city.toUpperCase()}\nCategory: ${category}\nVenue: ${venue}\nDate & Time: ${formattedDate} IST\nGuests: ${totalGuests} Admissions\nAmount Paid: ${formattedAmount}\nBooking ID: ${orderId}\n\nPass Codes:\n${ticketIds.map((id, i) => `PASS 0${i + 1} — ${id}`).join("\n")}\n\nView tickets in your account:\n${accountUrl}\n\nPresent this confirmation and a government photo ID at the entrance. Keep pass codes confidential.\n\n19.0760°N · 72.8777°E · EMERGENCE`;

  const ticketRows = ticketIds
    .map(
      (id, idx) => `
      <div style="background-color:#060608;border:1px solid #14141a;padding:12px 14px;font-size:11px;color:#8f8f9d;letter-spacing:1px;margin-bottom:6px;">
        PASS 0${idx + 1} &mdash; ${id}
      </div>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmed Tickets — TWKTK</title>
</head>
<body style="margin:0;padding:0;background-color:#050507;color:#ffffff;font-family:'IBM Plex Mono',Menlo,Consolas,monospace;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#050507;width:100%;table-layout:fixed;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:500px;background-color:#09090d;border:1px solid #1a1a20;">
          
          <!-- TOP LOGO / LABEL -->
          <tr>
            <td style="padding:36px 36px 28px 36px;border-bottom:1px solid #14141a;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle">
                    <img src="cid:twktk-logo" onerror="this.onerror=null;this.src='${logoUrl}';" alt="TWKTK" width="36" height="36" style="display:block;border:0;width:36px;height:36px;border-radius:50%;" />
                  </td>
                  <td align="right" valign="middle">
                    <div style="font-size:10px;letter-spacing:2px;color:#737380;text-transform:uppercase;">CONFIRMATION</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- HEADER -->
          <tr>
            <td style="padding:36px 36px 24px 36px;">
              <div style="font-size:11px;letter-spacing:2px;color:#737380;text-transform:uppercase;margin-bottom:12px;">TWKTK FESTIVAL</div>
              <h1 style="margin:0 0 8px 0;font-size:20px;font-weight:600;letter-spacing:1px;color:#ffffff;text-transform:uppercase;line-height:1.3;">
                Tickets Confirmed
              </h1>
              <div style="font-size:12px;color:#737380;letter-spacing:1px;text-transform:uppercase;">
                ${city.toUpperCase()} &middot; ${eventTitle}
              </div>
            </td>
          </tr>

          <!-- DETAILS GRID -->
          <tr>
            <td style="padding:0 36px 28px 36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #14141a;">
                <tr>
                  <td style="padding:14px 0;border-bottom:1px solid #14141a;font-size:11px;color:#737380;text-transform:uppercase;letter-spacing:1px;">Category</td>
                  <td align="right" style="padding:14px 0;border-bottom:1px solid #14141a;font-size:12px;color:#ffffff;font-weight:600;">${category}</td>
                </tr>
                <tr>
                  <td style="padding:14px 0;border-bottom:1px solid #14141a;font-size:11px;color:#737380;text-transform:uppercase;letter-spacing:1px;">Venue</td>
                  <td align="right" style="padding:14px 0;border-bottom:1px solid #14141a;font-size:12px;color:#ffffff;">${venue}</td>
                </tr>
                <tr>
                  <td style="padding:14px 0;border-bottom:1px solid #14141a;font-size:11px;color:#737380;text-transform:uppercase;letter-spacing:1px;">Date & Time</td>
                  <td align="right" style="padding:14px 0;border-bottom:1px solid #14141a;font-size:12px;color:#ffffff;">${formattedDate} IST</td>
                </tr>
                <tr>
                  <td style="padding:14px 0;border-bottom:1px solid #14141a;font-size:11px;color:#737380;text-transform:uppercase;letter-spacing:1px;">Guests</td>
                  <td align="right" style="padding:14px 0;border-bottom:1px solid #14141a;font-size:12px;color:#ffffff;">${totalGuests} Admissions</td>
                </tr>
                <tr>
                  <td style="padding:14px 0;border-bottom:1px solid #14141a;font-size:11px;color:#737380;text-transform:uppercase;letter-spacing:1px;">Amount Paid</td>
                  <td align="right" style="padding:14px 0;border-bottom:1px solid #14141a;font-size:12px;color:#ffffff;font-weight:600;">${formattedAmount}</td>
                </tr>
                <tr>
                  <td style="padding:14px 0;border-bottom:1px solid #14141a;font-size:11px;color:#737380;text-transform:uppercase;letter-spacing:1px;">Booking ID</td>
                  <td align="right" style="padding:14px 0;border-bottom:1px solid #14141a;font-size:11px;color:#8f8f9d;letter-spacing:1px;">${orderId}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- PASS CODES -->
          <tr>
            <td style="padding:0 36px 32px 36px;">
              <div style="font-size:10px;color:#50505e;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Pass Codes</div>
              ${ticketRows}
            </td>
          </tr>

          <!-- BUTTON -->
          <tr>
            <td style="padding:0 36px 36px 36px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td>
                    <a href="${accountUrl}" target="_blank" style="display:inline-block;padding:14px 28px;background-color:#ffffff;color:#050507;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;text-decoration:none;border-radius:1px;">
                      View My Tickets &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              <div style="font-size:11px;color:#50505e;line-height:1.6;">
                Present this confirmation and a government photo ID at the entrance. Keep pass codes confidential.
              </div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:20px 36px;border-top:1px solid #14141a;background-color:#07070a;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:10px;color:#50505e;letter-spacing:1px;text-transform:uppercase;">
                    19.0760&deg;N &middot; 72.8777&deg;E
                  </td>
                  <td align="right" style="font-size:10px;color:#50505e;letter-spacing:1px;text-transform:uppercase;">
                    EMERGENCE
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { html, text: plainText };
}
