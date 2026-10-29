/**
 * Security Training - starter course library
 *
 * Ready-made awareness courses an admin can install for their organization.
 * Each course has a narrated animated lesson (see training-library-lessons.ts)
 * and exactly 10 multiple-choice questions.
 */

import type { TrainingCourseCategory } from "@/lib/db/schema/security-training"
import type { TrainingLesson } from "./training-lesson"
import { LIBRARY_LESSONS } from "./training-library-lessons"

export interface LibraryQuestion {
  question: string
  options: string[]
  correctOptionIndex: number
  explanation: string
}

export interface LibraryCourse {
  key: string
  title: string
  description: string
  category: TrainingCourseCategory
  lesson: TrainingLesson
  passingScore: number
  questions: LibraryQuestion[]
}

export const TRAINING_LIBRARY: LibraryCourse[] = [
  // ==========================================================================
  // PHISHING
  // ==========================================================================
  {
    key: "phishing-emails",
    title: "Phishing Emails: Spot the Hook",
    description:
      "Learn to recognise phishing emails, the tricks attackers use to create urgency, and what to do when a suspicious message lands in your inbox.",
    category: "phishing",
    lesson: LIBRARY_LESSONS["phishing-emails"],
    passingScore: 80,
    questions: [
      {
        question: "Which of these is the strongest sign that an email may be a phishing attempt?",
        options: [
          "It comes from a colleague you email every day about routine work",
          "It urgently asks you to verify your password through a link",
          "It contains your company's logo in the signature",
          "It was sent during normal business hours",
        ],
        correctOptionIndex: 1,
        explanation: "Urgent requests to enter credentials through a link are a classic phishing pattern. Legitimate services rarely ask you to verify passwords by email.",
      },
      {
        question: "You receive an email from \"IT Support\" at it-support@yourcompany-helpdesk.com. What should you notice first?",
        options: [
          "The domain is not your company's real domain",
          "The email uses a friendly greeting",
          "The subject line is in title case",
          "The message has no attachments",
        ],
        correctOptionIndex: 0,
        explanation: "Look-alike domains (extra words, swapped letters) are a common way attackers impersonate internal teams.",
      },
      {
        question: "What is the safest way to check where a link in an email really goes?",
        options: [
          "Click it quickly and close the tab if it looks wrong",
          "Reply to the sender and ask if it is safe",
          "Hover over the link to preview the real destination before clicking",
          "Forward the email to a colleague to click it first",
        ],
        correctOptionIndex: 2,
        explanation: "Hovering shows the actual URL without visiting it. The visible link text can say anything.",
      },
      {
        question: "An email says your account will be locked in 1 hour unless you act now. What is this tactic called?",
        options: ["Encryption", "Creating false urgency", "Two-factor authentication", "Spam filtering"],
        correctOptionIndex: 1,
        explanation: "Attackers create pressure so you act before you think. Slow down whenever a message demands immediate action.",
      },
      {
        question: "You think you have received a phishing email. What should you do?",
        options: [
          "Delete it and tell no one",
          "Reply asking the sender to stop",
          "Report it using your company's reporting process or to the security team",
          "Forward it to all colleagues as a warning",
        ],
        correctOptionIndex: 2,
        explanation: "Reporting lets the security team block the campaign and warn others safely. Mass-forwarding spreads the malicious link further.",
      },
      {
        question: "An unexpected email contains an attachment called \"Invoice_2291.zip\" from an unknown supplier. What is the best action?",
        options: [
          "Open it to see which invoice it is",
          "Do not open it; verify with the supplier through a known contact and report it",
          "Open it on your phone instead of your laptop",
          "Save it to a shared drive for later",
        ],
        correctOptionIndex: 1,
        explanation: "Unexpected compressed or macro-enabled attachments are a common way to deliver malware. Verify through a trusted channel first.",
      },
      {
        question: "You clicked a link in a suspicious email and entered your password. What should you do first?",
        options: [
          "Wait to see if anything bad happens",
          "Clear your browser history",
          "Change your password immediately and report it to the security team",
          "Log out and log back in",
        ],
        correctOptionIndex: 2,
        explanation: "Speed matters. Changing the password and reporting quickly limits what an attacker can do with stolen credentials.",
      },
      {
        question: "Which greeting is most typical of a mass phishing email?",
        options: ["\"Hi Sarah,\"", "\"Dear Valued Customer,\"", "\"Morning team,\"", "\"Hello again,\""],
        correctOptionIndex: 1,
        explanation: "Generic greetings suggest the sender does not actually know you. Note that targeted (spear) phishing may still use your real name.",
      },
      {
        question: "Phishing can arrive through which channels?",
        options: [
          "Email only",
          "Email and text messages only",
          "Email, text messages, phone calls, and social media",
          "Only through unknown websites",
        ],
        correctOptionIndex: 2,
        explanation: "Smishing (SMS), vishing (voice) and social media messages use the same tricks as email phishing.",
      },
      {
        question: "Your manager emails asking you to urgently buy gift cards and send the codes. What should you do?",
        options: [
          "Buy them quickly since it is your manager",
          "Reply to the email to confirm the amount",
          "Verify the request by calling your manager on a known number or in person",
          "Buy a smaller amount to be safe",
        ],
        correctOptionIndex: 2,
        explanation: "Gift card requests are a common impersonation scam. Always verify unusual payment requests through a separate, trusted channel.",
      },
    ],
  },

  // ==========================================================================
  // PASSWORDS
  // ==========================================================================
  {
    key: "passwords-mfa",
    title: "Strong Passwords & Multi-Factor Authentication",
    description:
      "Create passwords that are hard to crack, avoid reuse, use a password manager, and understand why multi-factor authentication matters.",
    category: "passwords",
    lesson: LIBRARY_LESSONS["passwords-mfa"],
    passingScore: 70,
    questions: [
      {
        question: "Which of these passwords is the strongest?",
        options: ["Password123!", "Summer2024", "correct-horse-battery-staple-91", "Qwerty!"],
        correctOptionIndex: 2,
        explanation: "Long passphrases made of unrelated words are both strong and memorable. Length matters more than complexity tricks.",
      },
      {
        question: "Why is reusing the same password across sites dangerous?",
        options: [
          "It makes the password expire faster",
          "If one site is breached, attackers can use it to log in to your other accounts",
          "Websites can see your other accounts",
          "It slows down your login",
        ],
        correctOptionIndex: 1,
        explanation: "Attackers test leaked credentials on many services (credential stuffing). A unique password per account contains the damage.",
      },
      {
        question: "What is the recommended way to manage many unique passwords?",
        options: [
          "Write them on a sticky note under the keyboard",
          "Store them in a plain text file on the desktop",
          "Use an approved password manager",
          "Use the same password with a different number at the end",
        ],
        correctOptionIndex: 2,
        explanation: "A password manager generates and stores strong unique passwords so you only need to remember one master passphrase.",
      },
      {
        question: "What does multi-factor authentication (MFA) add to a login?",
        options: [
          "A second password that is the same as the first",
          "A requirement for a second proof such as an authenticator code or security key",
          "A longer username",
          "Automatic password changes every day",
        ],
        correctOptionIndex: 1,
        explanation: "MFA combines something you know with something you have (or are), so a stolen password alone is not enough.",
      },
      {
        question: "You receive an MFA prompt on your phone that you did not trigger. What should you do?",
        options: [
          "Approve it so the notifications stop",
          "Deny it, change your password, and report it to security",
          "Ignore it and approve the next one",
          "Turn off MFA",
        ],
        correctOptionIndex: 1,
        explanation: "An unexpected prompt means someone may already have your password. Never approve prompts you did not start (\"MFA fatigue\" attacks).",
      },
      {
        question: "A colleague asks for your password to finish a task while you are on leave. What should you do?",
        options: [
          "Share it since they are a trusted colleague",
          "Share it by text message instead of email",
          "Never share it; ask IT to grant them the access they need",
          "Share it and change it when you return",
        ],
        correctOptionIndex: 2,
        explanation: "Passwords are personal. Shared credentials break accountability; access should be granted through proper channels.",
      },
      {
        question: "Which piece of information should you avoid using in a password?",
        options: [
          "Random unrelated words",
          "Your pet's name or birthday",
          "A mix of letters and symbols",
          "A long phrase",
        ],
        correctOptionIndex: 1,
        explanation: "Personal details are often discoverable on social media and are among the first things attackers guess.",
      },
      {
        question: "Which MFA method is generally the most resistant to phishing?",
        options: [
          "A code sent by SMS",
          "A hardware security key or passkey",
          "Security questions such as your mother's maiden name",
          "An email with a login link",
        ],
        correctOptionIndex: 1,
        explanation: "Security keys and passkeys are bound to the real website, so they cannot be used on a fake login page.",
      },
      {
        question: "When should you change a password immediately?",
        options: [
          "Only once a year",
          "When you suspect it has been exposed or the service reports a breach",
          "Every time you log in",
          "Never, if it is long enough",
        ],
        correctOptionIndex: 1,
        explanation: "Change passwords promptly when there is any sign of compromise. Forced frequent changes otherwise tend to produce weaker passwords.",
      },
      {
        question: "Where is it acceptable to type your work password?",
        options: [
          "On any site that shows the company logo",
          "Only on the genuine company login page you navigated to yourself",
          "In a reply to IT support emails",
          "In a pop-up that appears after clicking an ad",
        ],
        correctOptionIndex: 1,
        explanation: "Logos are easy to copy. Navigate to login pages yourself or use bookmarks instead of following links in messages.",
      },
    ],
  },

  // ==========================================================================
  // SOCIAL ENGINEERING
  // ==========================================================================
  {
    key: "social-engineering",
    title: "Social Engineering: Don't Get Manipulated",
    description:
      "Understand how attackers exploit trust, authority and helpfulness by phone, in person and online, and how to verify before you act.",
    category: "social_engineering",
    lesson: LIBRARY_LESSONS["social-engineering"],
    passingScore: 70,
    questions: [
      {
        question: "What is social engineering?",
        options: [
          "Designing social media campaigns",
          "Manipulating people into revealing information or taking actions that benefit an attacker",
          "Building secure network infrastructure",
          "A type of antivirus software",
        ],
        correctOptionIndex: 1,
        explanation: "Social engineering targets human behaviour rather than technical weaknesses.",
      },
      {
        question: "Someone calls claiming to be from IT and asks for your login to \"fix an issue\". What should you do?",
        options: [
          "Give it to them so the issue gets fixed",
          "Refuse, hang up, and contact IT through the official helpdesk number",
          "Give them only your username",
          "Ask them to email you instead and then send it",
        ],
        correctOptionIndex: 1,
        explanation: "Legitimate IT staff will never ask for your password. Call back using a number you already trust.",
      },
      {
        question: "A person without a badge follows you through a secure door, saying they forgot theirs. This is called:",
        options: ["Tailgating", "Encryption", "Patching", "Whitelisting"],
        correctOptionIndex: 0,
        explanation: "Tailgating (or piggybacking) bypasses physical access controls. Politely direct the person to reception or security.",
      },
      {
        question: "Which emotion do social engineers most commonly try to trigger?",
        options: ["Boredom", "Urgency or fear", "Calm confidence", "Indifference"],
        correctOptionIndex: 1,
        explanation: "Pressure and fear make people skip normal checks. Pausing to verify defeats most attempts.",
      },
      {
        question: "You find a USB stick labelled \"Salaries 2025\" in the car park. What should you do?",
        options: [
          "Plug it into your laptop to find the owner",
          "Plug it into a shared computer instead",
          "Hand it to IT or security without plugging it in",
          "Take it home to check it",
        ],
        correctOptionIndex: 2,
        explanation: "Dropped USB devices are a known attack technique. Unknown devices can install malware the moment they are connected.",
      },
      {
        question: "What is \"pretexting\"?",
        options: [
          "Sending a text message before a meeting",
          "Inventing a believable scenario or identity to gain trust and information",
          "Encrypting text messages",
          "Writing a draft before an email",
        ],
        correctOptionIndex: 1,
        explanation: "Attackers build a story (new employee, auditor, supplier) to make their requests seem legitimate.",
      },
      {
        question: "A caller says they are a senior executive and demands confidential data immediately. What is the best response?",
        options: [
          "Send it right away because of their seniority",
          "Verify their identity through a known channel before sharing anything",
          "Send a partial version of the data",
          "Ask a colleague to send it instead",
        ],
        correctOptionIndex: 1,
        explanation: "Authority is a common lever. Real executives will understand verification; attackers will push back.",
      },
      {
        question: "Which information is safe to post publicly about your job?",
        options: [
          "Photos of your badge and desk with screens visible",
          "Details of internal systems and who approves payments",
          "General information like your job title, with no sensitive details",
          "Your travel itinerary for an upcoming business trip",
        ],
        correctOptionIndex: 2,
        explanation: "Attackers research targets on social media. Badges, screens, org details and travel plans help them craft convincing attacks.",
      },
      {
        question: "A supplier emails to say their bank details have changed for future invoices. What should you do?",
        options: [
          "Update the details straight away",
          "Reply to the email to confirm the change",
          "Confirm the change by calling the supplier on a number from your existing records",
          "Pay the next invoice to both accounts",
        ],
        correctOptionIndex: 2,
        explanation: "Payment redirection fraud relies on unverified bank detail changes. Always verify using contact details you already hold.",
      },
      {
        question: "What is the single most effective defence against social engineering?",
        options: [
          "A faster computer",
          "Verifying unusual requests through a separate, trusted channel",
          "Using a longer email signature",
          "Turning off your phone",
        ],
        correctOptionIndex: 1,
        explanation: "Independent verification breaks the attacker's script no matter how convincing it is.",
      },
    ],
  },

  // ==========================================================================
  // RANSOMWARE
  // ==========================================================================
  {
    key: "ransomware",
    title: "Ransomware & Malware Basics",
    description:
      "Learn how ransomware gets in, the early warning signs of infection, and the right first steps if you suspect your device is compromised.",
    category: "device_security",
    lesson: LIBRARY_LESSONS.ransomware,
    passingScore: 70,
    questions: [
      {
        question: "What does ransomware do?",
        options: [
          "Speeds up your computer",
          "Encrypts or locks your files and demands payment to restore them",
          "Backs up your files automatically",
          "Blocks spam emails",
        ],
        correctOptionIndex: 1,
        explanation: "Ransomware holds data hostage, and modern variants often steal data before encrypting it.",
      },
      {
        question: "What is the most common way ransomware enters an organisation?",
        options: [
          "Through the office printer's paper tray",
          "Through phishing emails and malicious attachments or links",
          "Through the building's air conditioning",
          "Through strong passwords",
        ],
        correctOptionIndex: 1,
        explanation: "Phishing remains a leading entry point, alongside unpatched systems and exposed remote access.",
      },
      {
        question: "Your screen suddenly shows a message saying your files are encrypted. What should you do first?",
        options: [
          "Pay the ransom quickly",
          "Disconnect from the network (unplug or turn off Wi-Fi) and report it immediately",
          "Restart the computer repeatedly",
          "Ignore it and keep working",
        ],
        correctOptionIndex: 1,
        explanation: "Isolating the device helps stop the spread to shared drives and other machines. Then contact security right away.",
      },
      {
        question: "Why is paying a ransom discouraged?",
        options: [
          "Payment is always refunded",
          "There is no guarantee of recovery, and it funds criminals and invites repeat attacks",
          "Ransoms are always very small",
          "Paying fixes the security weakness",
        ],
        correctOptionIndex: 1,
        explanation: "Decryption may fail, data may still be leaked, and paying marks you as a willing target.",
      },
      {
        question: "Which practice best protects an organisation's data against ransomware?",
        options: [
          "Keeping only one copy of each file",
          "Regular, tested backups kept separate from the main network",
          "Saving everything to the desktop",
          "Turning off automatic updates",
        ],
        correctOptionIndex: 1,
        explanation: "Offline or isolated backups that are regularly tested allow recovery without paying.",
      },
      {
        question: "Which of these could be an early warning sign of malware?",
        options: [
          "Files with strange new extensions and a sudden slowdown",
          "Your calendar showing a meeting",
          "A colleague's out-of-office reply",
          "A scheduled software update notice from IT",
        ],
        correctOptionIndex: 0,
        explanation: "Unusual file names, pop-ups, slowdowns and disabled security tools can indicate an infection. Report them early.",
      },
      {
        question: "A document asks you to \"Enable macros\" to view its content. What should you do?",
        options: [
          "Enable macros to read it",
          "Do not enable macros unless you are certain the document is legitimate; report if unsure",
          "Forward it to colleagues to see if it works for them",
          "Print it first",
        ],
        correctOptionIndex: 1,
        explanation: "Malicious macros are a common way to run malware. Legitimate documents rarely need them.",
      },
      {
        question: "Why should you install software updates promptly?",
        options: [
          "They change the colour scheme",
          "They fix security vulnerabilities attackers actively exploit",
          "They are optional cosmetic changes",
          "They remove your files",
        ],
        correctOptionIndex: 1,
        explanation: "Many ransomware attacks exploit known, already-patched vulnerabilities on systems that were not updated.",
      },
      {
        question: "Where should you download work software from?",
        options: [
          "Any site that appears first in search results",
          "Approved company sources or the official vendor",
          "Links shared in public forums",
          "Pop-up ads offering free versions",
        ],
        correctOptionIndex: 1,
        explanation: "Unofficial downloads and cracked software are frequently bundled with malware.",
      },
      {
        question: "You think you may have opened a malicious file but nothing seems wrong. What should you do?",
        options: [
          "Do nothing since nothing happened",
          "Report it to the security team right away",
          "Delete the file and forget about it",
          "Run it again to check",
        ],
        correctOptionIndex: 1,
        explanation: "Malware can stay quiet for a while. Early reporting gives the security team time to contain it.",
      },
    ],
  },

  // ==========================================================================
  // PUBLIC WI-FI / REMOTE WORK
  // ==========================================================================
  {
    key: "public-wifi-remote-work",
    title: "Public Wi-Fi & Working Remotely",
    description:
      "Stay secure when working from cafés, airports and home: risky networks, using the VPN, protecting your screen, and keeping devices safe.",
    category: "data_protection",
    lesson: LIBRARY_LESSONS["public-wifi-remote-work"],
    passingScore: 70,
    questions: [
      {
        question: "What is the main risk of using open public Wi-Fi?",
        options: [
          "It is always slower",
          "Attackers on the same network may intercept traffic or run fake hotspots",
          "It drains your battery",
          "It deletes your browser history",
        ],
        correctOptionIndex: 1,
        explanation: "Open networks can be monitored, and attackers can create convincing look-alike hotspots (evil twins).",
      },
      {
        question: "What should you use to protect work traffic on a public network?",
        options: [
          "Incognito mode",
          "The company-approved VPN",
          "A bigger screen",
          "Bluetooth",
        ],
        correctOptionIndex: 1,
        explanation: "A VPN encrypts traffic between your device and the company network. Incognito mode only avoids saving local history.",
      },
      {
        question: "A café has two networks: \"CoffeeShop_Guest\" and \"CoffeeShop_Free_WiFi\". What should you do?",
        options: [
          "Join the one with the strongest signal",
          "Ask staff which network is genuine",
          "Join both",
          "Join the one without a password",
        ],
        correctOptionIndex: 1,
        explanation: "Attackers name fake hotspots to look legitimate. Confirm the real network name with the venue.",
      },
      {
        question: "Which alternative is generally safer than public Wi-Fi for work?",
        options: [
          "A neighbour's unsecured network",
          "Your phone's personal hotspot",
          "Any network without a password",
          "A network found by scanning nearby",
        ],
        correctOptionIndex: 1,
        explanation: "A personal hotspot is under your control and is not shared with strangers.",
      },
      {
        question: "What is \"shoulder surfing\"?",
        options: [
          "Carrying a laptop on your shoulder",
          "Someone looking over your shoulder to read your screen or watch you type",
          "A type of Wi-Fi encryption",
          "Browsing many websites quickly",
        ],
        correctOptionIndex: 1,
        explanation: "In public places, position your screen carefully or use a privacy filter for sensitive work.",
      },
      {
        question: "You step away from your laptop in a coffee shop for a minute. What should you do?",
        options: [
          "Leave it unlocked since you will be quick",
          "Lock the screen or take the laptop with you",
          "Ask a stranger to watch it",
          "Close the lid halfway",
        ],
        correctOptionIndex: 1,
        explanation: "Unattended devices can be stolen or accessed in seconds. Lock the screen (Win+L / Ctrl+Cmd+Q) or keep it with you.",
      },
      {
        question: "Which is the best practice for your home Wi-Fi router?",
        options: [
          "Keep the default admin password",
          "Use a strong Wi-Fi password and change the default admin password",
          "Turn off encryption for speed",
          "Share the password publicly",
        ],
        correctOptionIndex: 1,
        explanation: "Default router credentials are widely known. WPA2/WPA3 with a strong passphrase protects your home network.",
      },
      {
        question: "You need to discuss confidential client details on a call. Where is the best place?",
        options: [
          "On a crowded train",
          "In a private space where you cannot be overheard",
          "In a queue at the airport",
          "In a café on speakerphone",
        ],
        correctOptionIndex: 1,
        explanation: "Verbal information leaks just as easily as digital data in public places.",
      },
      {
        question: "Your work laptop is stolen while travelling. What should you do?",
        options: [
          "Wait until you are back in the office to mention it",
          "Report it to IT/security immediately so access can be revoked and the device wiped",
          "Buy a replacement and say nothing",
          "Post about it on social media",
        ],
        correctOptionIndex: 1,
        explanation: "Prompt reporting lets IT lock accounts, remotely wipe the device and assess any data exposure.",
      },
      {
        question: "Is it safe to access work systems from a shared or public computer, such as a hotel business centre?",
        options: [
          "Yes, as long as you log out",
          "No, avoid it; the device may have keyloggers or saved sessions",
          "Yes, if you use incognito mode",
          "Yes, if the hotel is expensive",
        ],
        correctOptionIndex: 1,
        explanation: "You cannot trust the security of shared machines. Use your managed work device.",
      },
    ],
  },

  // ==========================================================================
  // SOFTWARE UPDATES / INCIDENT REPORTING
  // ==========================================================================
  {
    key: "updates-and-reporting",
    title: "Software Updates & Reporting Incidents",
    description:
      "Why keeping devices patched matters, and how and when to report security incidents so problems are caught early.",
    category: "incident_reporting",
    lesson: LIBRARY_LESSONS["updates-and-reporting"],
    passingScore: 70,
    questions: [
      {
        question: "What is the main security reason to install software updates?",
        options: [
          "To get new emojis",
          "To fix vulnerabilities that attackers could exploit",
          "To use more disk space",
          "To reset your settings",
        ],
        correctOptionIndex: 1,
        explanation: "Updates often patch security flaws that are already publicly known and actively exploited.",
      },
      {
        question: "Your laptop shows an approved update that requires a restart. What should you do?",
        options: [
          "Postpone it indefinitely",
          "Install it as soon as practical, saving your work first",
          "Disable automatic updates",
          "Uninstall the software instead",
        ],
        correctOptionIndex: 1,
        explanation: "Delaying updates leaves known holes open. Plan a restart at a convenient moment, but do not skip it.",
      },
      {
        question: "A pop-up on a website says your browser is outdated and offers a download. What should you do?",
        options: [
          "Download it immediately",
          "Close it and update only through the browser's own settings or IT",
          "Click it twice to be sure",
          "Share the link with colleagues",
        ],
        correctOptionIndex: 1,
        explanation: "Fake update prompts are a common way to deliver malware. Use official update mechanisms only.",
      },
      {
        question: "Which devices need security updates?",
        options: [
          "Only laptops",
          "Only servers",
          "Laptops, phones, tablets, and other connected devices",
          "Only devices older than five years",
        ],
        correctOptionIndex: 2,
        explanation: "Any connected device running software can have vulnerabilities, including phones and smart devices.",
      },
      {
        question: "What counts as a security incident you should report?",
        options: [
          "Only confirmed data breaches",
          "Any suspected or actual event that could harm the confidentiality, integrity or availability of information",
          "Only incidents that cost money",
          "Only incidents caused by other people",
        ],
        correctOptionIndex: 1,
        explanation: "Report suspicions too. It is better to report something harmless than miss something serious.",
      },
      {
        question: "You accidentally emailed a spreadsheet containing customer data to the wrong person. What should you do?",
        options: [
          "Hope they do not open it",
          "Report it to the security or data protection team immediately",
          "Send another email asking them to ignore it, and do nothing else",
          "Delete it from your sent folder",
        ],
        correctOptionIndex: 1,
        explanation: "Misdirected emails can be data breaches with legal reporting deadlines. Fast reporting allows proper handling.",
      },
      {
        question: "Why is reporting incidents quickly so important?",
        options: [
          "It is not important",
          "It limits the damage and helps meet legal and regulatory deadlines",
          "It gets the person who made the mistake in trouble",
          "It increases the amount of paperwork",
        ],
        correctOptionIndex: 1,
        explanation: "Many regulations require breach notification within tight deadlines, such as 72 hours under GDPR.",
      },
      {
        question: "What should you avoid doing after discovering a possible incident on your device?",
        options: [
          "Reporting it to security",
          "Writing down what you saw and when",
          "Trying to investigate or clean it up yourself in ways that destroy evidence",
          "Following the security team's instructions",
        ],
        correctOptionIndex: 2,
        explanation: "Well-meant clean-up can erase the evidence investigators need. Report it and follow guidance.",
      },
      {
        question: "Someone reports a mistake that caused a security incident. What is the right culture to encourage?",
        options: [
          "Blame and punish to discourage future mistakes",
          "No-blame reporting so people feel safe to speak up quickly",
          "Ignoring reports unless there is proof",
          "Keeping incidents secret from everyone",
        ],
        correctOptionIndex: 1,
        explanation: "People hide mistakes when they fear blame. Early, honest reporting is what keeps an organisation safe.",
      },
      {
        question: "Which detail is most helpful to include when reporting an incident?",
        options: [
          "Your opinion of who is at fault",
          "What happened, when, which systems or data were involved, and what you have done so far",
          "Only the subject line of the email",
          "Nothing, just say there is a problem",
        ],
        correctOptionIndex: 1,
        explanation: "Clear facts and a timeline help the response team act quickly and correctly.",
      },
    ],
  },
]
