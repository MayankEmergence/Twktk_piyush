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
  const logoUrl = `${origin}/assets/brand/logo.png`;
  const badgeTitle = isSignup ? "REGISTRATION // EMAIL VERIFICATION" : "AUTHENTICATION // SECURE ACCESS";
  const mainTitle = isSignup ? "VERIFY YOUR ACCOUNT" : "ENTER YOUR WORLD";
  const subtitle = isSignup
    ? "Confirm your email address and activate your festival pass access."
    : "Your private access link to the TWKTK universe is ready.";
  const buttonText = isSignup ? "CONFIRM & ENTER WORLD →" : "ACCESS YOUR ACCOUNT →";
  const plainText = `${mainTitle}\n\nThose Who Know They Know\n\n${subtitle}\n\nAccess Link:\n${link}\n\nThis link expires in 15 minutes and can only be used once.\nIf you did not request this, you can safely ignore this email.\n\nTWKTK Festival · Emergence Network · 19.0760°N, 72.8777°E`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${mainTitle}</title>
  <!--[if mso]>
  <style type="text/css">
    table {border-collapse:collapse;border-spacing:0;margin:0;}
    div, td {padding:0;}
    div {margin:0 !important;}
  </style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#060608;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'IBM Plex Mono',monospace;line-height:1.6;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#060608;width:100%;table-layout:fixed;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <!-- MAIN CONTAINER -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;background-color:#0b0b12;border:1px solid #1f1f2e;border-radius:12px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.8);">
          
          <!-- TOP ACCENT BAR -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg, #d81f26 0%, #ff3b41 50%, #e2a348 100%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- HEADER / LOGO -->
          <tr>
            <td align="center" style="padding:36px 30px 24px 30px;background-color:#0b0b12;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <img src="cid:twktk-logo" onerror="this.onerror=null;this.src='${logoUrl}';" alt="TWKTK" width="56" height="56" style="display:block;border:0;width:56px;height:56px;border-radius:50%;border:1px solid #ff3b41;background-color:#050507;" />
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:16px;">
                    <div style="font-family:'Syncopate',Arial,sans-serif;font-weight:700;font-size:15px;letter-spacing:3px;color:#ffffff;text-transform:uppercase;">THOSE WHO KNOW</div>
                    <div style="font-family:'Syncopate',Arial,sans-serif;font-weight:700;font-size:12px;letter-spacing:5px;color:#ff3b41;text-transform:uppercase;margin-top:2px;">THEY KNOW</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- PROTOCOL BADGE -->
          <tr>
            <td align="center" style="padding:0 30px 20px 30px;">
              <div style="display:inline-block;padding:6px 14px;background-color:rgba(216,31,38,0.12);border:1px solid rgba(255,59,65,0.3);border-radius:20px;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:600;letter-spacing:2px;color:#ff3b41;text-transform:uppercase;">
                ${badgeTitle}
              </div>
            </td>
          </tr>

          <!-- CONTENT BODY -->
          <tr>
            <td style="padding:0 36px 36px 36px;text-align:center;">
              <h1 style="margin:0 0 12px 0;font-family:'Syncopate',Arial,sans-serif;font-size:22px;font-weight:700;letter-spacing:1px;color:#ffffff;text-transform:uppercase;">
                ${mainTitle}
              </h1>
              <p style="margin:0 0 28px 0;font-size:14px;color:#9ca3af;line-height:1.7;">
                ${subtitle}
              </p>

              <!-- CTA BUTTON -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:30px 0 32px 0;">
                <tr>
                  <td align="center">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${link}" style="height:50px;v-text-anchor:middle;width:280px;" arcsize="12%" stroke="f" fillcolor="#d81f26">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;letter-spacing:2px;">${buttonText}</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-- -->
                    <a href="${link}" target="_blank" style="display:inline-block;padding:16px 36px;background:linear-gradient(135deg, #d81f26 0%, #ff3b41 100%);color:#ffffff;font-family:'Syncopate',Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:2px;text-decoration:none;border-radius:6px;text-transform:uppercase;box-shadow:0 8px 24px rgba(216,31,38,0.4);">
                      ${buttonText}
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <!-- SECURITY NOTICE BOX -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0f0f18;border:1px solid #1f1f2e;border-radius:8px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;text-align:left;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="20" valign="top" style="padding-right:12px;font-size:14px;color:#ff3b41;">🔒</td>
                        <td style="font-size:12px;color:#9ca3af;line-height:1.6;">
                          <strong style="color:#ffffff;">Security Notice:</strong> This link is valid for <span style="color:#ff3b41;font-weight:600;">15 minutes</span> and operates once. Never forward or share this email. If you did not initiate this request, your account remains secure and no action is necessary.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- FALLBACK LINK BOX -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px dashed #1f1f2e;padding-top:20px;">
                <tr>
                  <td style="text-align:left;">
                    <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#6b7280;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">Direct Access URL</div>
                    <div style="background-color:#07070a;border:1px solid #1a1a26;border-radius:6px;padding:12px;word-break:break-all;font-family:'IBM Plex Mono',monospace;font-size:11px;color:#9ca3af;line-height:1.5;">
                      <a href="${link}" target="_blank" style="color:#e2a348;text-decoration:none;">${link}</a>
                    </div>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color:#07070c;padding:24px 30px;border-top:1px solid #161622;text-align:center;">
              <div style="font-family:'Syncopate',Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:2px;color:#ffffff;text-transform:uppercase;">
                TWKTK FESTIVAL · WORLDLINE
              </div>
              <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#6b7280;letter-spacing:1px;margin-top:6px;">
                19.0760°N · 72.8777°E · EMERGENCE NETWORK
              </div>
              <div style="font-size:11px;color:#4b5563;margin-top:12px;">
                You received this email because an action was performed for <span style="color:#9ca3af;">${email}</span>.
              </div>
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
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
  const formattedAmount = (amount / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });

  const plainText = `CONFIRMED FESTIVAL PASS // TWKTK\n\nYour tickets are confirmed.\n\nEvent: ${eventTitle} (${city})\nDate & Time: ${formattedDate} IST\nVenue: ${venue}\nCategory: ${category}\nAdmissions: ${totalGuests} Guests\nPayment: ${formattedAmount}\nBooking ID: ${orderId}\n\nTicket Pass IDs:\n${ticketIds.join("\n")}\n\nView and manage your tickets:\n${accountUrl}\n\nImportant: Bring this ticket confirmation and a valid government photo ID for entry at the gate. Keep your ticket IDs private.\n\nTWKTK Festival · Emergence Network · 19.0760°N, 72.8777°E`;

  const ticketRows = ticketIds
    .map(
      (id, idx) => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background-color:#0a0a10;border:1px solid #1c1c2a;border-radius:4px;margin-bottom:6px;font-family:'IBM Plex Mono',monospace;font-size:11px;">
        <span style="color:#ff3b41;font-weight:600;">PASS #${idx + 1}</span>
        <span style="color:#ffffff;letter-spacing:1px;">${id}</span>
      </div>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Your TWKTK Tickets are Confirmed</title>
</head>
<body style="margin:0;padding:0;background-color:#060608;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'IBM Plex Mono',monospace;line-height:1.6;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#060608;width:100%;table-layout:fixed;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;background-color:#0b0b12;border:1px solid #1f1f2e;border-radius:12px;overflow:hidden;box-shadow:0 24px 48px rgba(0,0,0,0.85);">
          
          <!-- TOP ACCENT BAR -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg, #d81f26 0%, #ff3b41 50%, #e2a348 100%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- HEADER / BRAND -->
          <tr>
            <td align="center" style="padding:32px 30px 20px 30px;background-color:#0b0b12;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <img src="cid:twktk-logo" onerror="this.onerror=null;this.src='${logoUrl}';" alt="TWKTK" width="56" height="56" style="display:block;border:0;width:56px;height:56px;border-radius:50%;border:1px solid #ff3b41;background-color:#050507;" />
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:14px;">
                    <div style="font-family:'Syncopate',Arial,sans-serif;font-weight:700;font-size:14px;letter-spacing:3px;color:#ffffff;text-transform:uppercase;">THOSE WHO KNOW</div>
                    <div style="font-family:'Syncopate',Arial,sans-serif;font-weight:700;font-size:11px;letter-spacing:5px;color:#ff3b41;text-transform:uppercase;margin-top:2px;">THEY KNOW</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- STATUS BADGE -->
          <tr>
            <td align="center" style="padding:0 30px 16px 30px;">
              <div style="display:inline-block;padding:6px 16px;background-color:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);border-radius:20px;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:600;letter-spacing:2px;color:#10b981;text-transform:uppercase;">
                ✓ FESTIVAL PASS CONFIRMED · PAYMENT RECEIVED
              </div>
            </td>
          </tr>

          <!-- HERO TITLE -->
          <tr>
            <td style="padding:0 36px 24px 36px;text-align:center;">
              <h1 style="margin:0 0 6px 0;font-family:'Syncopate',Arial,sans-serif;font-size:24px;font-weight:700;letter-spacing:1px;color:#ffffff;text-transform:uppercase;">
                ${eventTitle}
              </h1>
              <div style="font-family:'Syncopate',Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:3px;color:#e2a348;text-transform:uppercase;">
                ${city} · OFFICIAL ADMISSION
              </div>
            </td>
          </tr>

          <!-- TICKET BOARDING PASS CARD -->
          <tr>
            <td style="padding:0 30px 30px 30px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0f0f18;border:1px solid #28283c;border-radius:10px;overflow:hidden;">
                <!-- TICKET HEADER -->
                <tr>
                  <td style="background-color:#151522;padding:14px 20px;border-bottom:1px solid #28283c;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:600;color:#9ca3af;letter-spacing:2px;text-transform:uppercase;">
                          PASS TIER
                        </td>
                        <td align="right">
                          <span style="display:inline-block;padding:4px 10px;background-color:#d81f26;color:#ffffff;font-family:'Syncopate',Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:1px;border-radius:4px;text-transform:uppercase;">
                            ${category}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- DETAILS GRID -->
                <tr>
                  <td style="padding:20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding-bottom:16px;">
                          <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#6b7280;letter-spacing:1px;text-transform:uppercase;">DATE & TIME</div>
                          <div style="font-size:14px;color:#ffffff;font-weight:600;margin-top:2px;">${formattedDate} IST</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom:16px;">
                          <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#6b7280;letter-spacing:1px;text-transform:uppercase;">VENUE</div>
                          <div style="font-size:14px;color:#ffffff;font-weight:600;margin-top:2px;">${venue}</div>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td width="50%" style="padding-right:10px;">
                                <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#6b7280;letter-spacing:1px;text-transform:uppercase;">GUEST ADMISSIONS</div>
                                <div style="font-size:16px;color:#ffffff;font-weight:700;margin-top:2px;">${totalGuests} Guests</div>
                              </td>
                              <td width="50%">
                                <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#6b7280;letter-spacing:1px;text-transform:uppercase;">AMOUNT PAID</div>
                                <div style="font-size:16px;color:#10b981;font-weight:700;margin-top:2px;">${formattedAmount}</div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- PERFORATION TEAR LINE -->
                <tr>
                  <td style="padding:0 12px;">
                    <div style="border-top:1px dashed #2d2d42;height:1px;font-size:0;line-height:0;">&nbsp;</div>
                  </td>
                </tr>

                <!-- TICKET IDS -->
                <tr>
                  <td style="padding:20px;background-color:#0d0d14;">
                    <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#6b7280;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">
                      BOOKING REFERENCE: <span style="color:#e2a348;">${orderId}</span>
                    </div>
                    ${ticketRows}
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- CTA BUTTON -->
          <tr>
            <td align="center" style="padding:0 36px 28px 36px;">
              <a href="${accountUrl}" target="_blank" style="display:inline-block;padding:16px 36px;background:linear-gradient(135deg, #d81f26 0%, #ff3b41 100%);color:#ffffff;font-family:'Syncopate',Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:2px;text-decoration:none;border-radius:6px;text-transform:uppercase;box-shadow:0 8px 24px rgba(216,31,38,0.4);">
                VIEW PASSES IN MY ACCOUNT →
              </a>
            </td>
          </tr>

          <!-- GATE RULES NOTICE -->
          <tr>
            <td style="padding:0 36px 30px 36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a10;border-left:3px solid #e2a348;border-radius:4px;padding:12px 16px;">
                <tr>
                  <td style="font-size:12px;color:#9ca3af;line-height:1.6;">
                    <strong style="color:#ffffff;">Gate Admission Protocol:</strong> Present this email or your passes from the portal along with a matching government-issued photo ID at entry. Keep all ticket IDs confidential.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color:#07070c;padding:24px 30px;border-top:1px solid #161622;text-align:center;">
              <div style="font-family:'Syncopate',Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:2px;color:#ffffff;text-transform:uppercase;">
                TWKTK FESTIVAL · WORLDLINE
              </div>
              <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#6b7280;letter-spacing:1px;margin-top:6px;">
                19.0760°N · 72.8777°E · EMERGENCE NETWORK
              </div>
              <div style="font-size:11px;color:#4b5563;margin-top:12px;">
                Issued to <span style="color:#9ca3af;">${email}</span> for Booking <span style="color:#9ca3af;">${orderId}</span>.
              </div>
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
