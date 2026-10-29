/**
 * Security Training - starter course lessons
 *
 * Narrated, animated lessons for the starter library. Each lesson covers everything
 * its 10-question quiz asks about. Keyed by library course key.
 *
 * Recorded narration (scripts/training-audio) is attached from the audio manifest for
 * every scene whose narration still matches the recording.
 */

import { narrationHash, type TrainingLesson } from "./training-lesson"
import audioManifest from "./training-audio-manifest.json"

interface AudioManifest {
  [courseKey: string]: {
    voice: string
    scenes: { narrationHash: string; file: string; durationMs: number; sentenceStartsMs: number[] }[]
  }
}

function withRecordedAudio(lessons: Record<string, TrainingLesson>): Record<string, TrainingLesson> {
  const manifest = audioManifest as AudioManifest
  return Object.fromEntries(
    Object.entries(lessons).map(([key, lesson]) => {
      const recordings = new Map((manifest[key]?.scenes ?? []).map((s) => [s.narrationHash, s]))
      return [
        key,
        {
          scenes: lesson.scenes.map((scene) => {
            const recording = recordings.get(narrationHash(scene.narration))
            if (!recording) return scene
            return {
              ...scene,
              audio: {
                url: `/training/audio/${key}/${recording.file}`,
                durationMs: recording.durationMs,
                sentenceStartsMs: recording.sentenceStartsMs,
              },
            }
          }),
        },
      ]
    })
  )
}

const LESSONS: Record<string, TrainingLesson> = {
  // ==========================================================================
  // PHISHING
  // ==========================================================================
  "phishing-emails": {
    scenes: [
      {
        title: "Welcome",
        narration:
          "Phishing is when attackers pretend to be someone you trust, to trick you into clicking a link, opening an attachment, or handing over your password. It is the most common way cyber attacks begin, and the best defence is you. In the next few minutes you will learn to spot the hook.",
        visual: { type: "title", heading: "Phishing Emails: Spot the Hook", subheading: "Recognise it. Don't bite. Report it.", icon: "mail" },
      },
      {
        title: "Anatomy of a phishing email",
        narration:
          "Here is a typical phishing email. Look at the sender first. The address ends in yourcompany-helpdesk dot com, a look-alike, not your real company domain. The greeting is generic: Dear Valued Customer. It threatens to suspend your account within one hour. And it asks you to verify your password through a link. Real IT teams never ask for your password by email.",
        visual: {
          type: "email",
          fromName: "IT Support",
          fromAddress: "it-support@yourcompany-helpdesk.com",
          subject: "URGENT: Your account will be suspended in 1 hour",
          body: [
            "Dear Valued Customer,",
            "We detected unusual sign-in activity on your mailbox. To avoid suspension, you must verify your password within 1 hour.",
            "Failure to act will result in permanent loss of access.",
          ],
          link: { text: "Verify my password", url: "http://yourcompany-helpdesk.com.login-verify.ru/auth" },
          flags: [
            { target: "from", label: "Look-alike domain, not your company's real one" },
            { target: "subject", label: "False urgency and threats" },
            { target: "body", label: "Generic greeting: Dear Valued Customer" },
            { target: "link", label: "Asks for your password through a link" },
          ],
        },
      },
      {
        title: "Common red flags",
        narration:
          "Pressure is the attacker's favourite tool. Messages that threaten to lock your account or demand action right now are designed to make you act before you think. Other red flags include look-alike sender addresses, generic greetings, requests for passwords or payments, and attachments you were not expecting, especially zip files or documents that ask you to enable macros.",
        visual: {
          type: "checklist",
          heading: "Red flags",
          items: [
            { text: "Urgency or threats: act now or lose access", good: false },
            { text: "Requests for passwords, codes or payments", good: false },
            { text: "Look-alike sender domains", good: false },
            { text: "Generic greetings like Dear Valued Customer", good: false },
            { text: "Unexpected attachments, such as Invoice.zip", good: false },
          ],
        },
      },
      {
        title: "Check links safely",
        narration:
          "Before clicking any link, hover your mouse over it. The real destination appears at the bottom of your screen. The visible text can say anything, so trust only the real address. If it doesn't match where you expect to go, don't click. Instead, open the website yourself using a bookmark, or by typing the address.",
        visual: {
          type: "steps",
          heading: "Check before you click",
          steps: [
            "Hover over the link without clicking",
            "Read the real address shown at the bottom of the screen",
            "If it doesn't match the sender or looks odd, don't click",
            "Go to the website yourself using a bookmark",
          ],
        },
      },
      {
        title: "Not just email",
        narration:
          "Phishing isn't just email. The same tricks arrive by text message, which is called smishing, by phone call, called vishing, and through social media messages. A surprise delivery fee, or a prize you never entered for, is the same hook in a different place.",
        visual: {
          type: "messages",
          channel: "sms",
          contact: "+44 7700 900123",
          messages: [
            { from: "them", text: "Royal Parcel: your package is on hold. Pay the £1.99 redelivery fee within 24h: parcel-redeliver.co/pay" },
            { from: "them", text: "Final reminder! Your parcel will be returned to sender today." },
          ],
        },
      },
      {
        title: "Fake requests from the boss",
        narration:
          "Watch out for messages that impersonate your manager or a senior leader, asking you to quickly buy gift cards or make an urgent payment. Don't reply to the message to confirm. Verify the request through a separate channel you already trust, such as calling them on a number you know, or asking in person.",
        visual: {
          type: "messages",
          channel: "chat",
          contact: "Sarah Chen (CEO)",
          messages: [
            { from: "them", text: "Are you at your desk? I need a quick favour, it's urgent." },
            { from: "them", text: "Please buy five £100 gift cards for a client and send me the codes. Keep it confidential." },
            { from: "you", text: "I'll call you on your usual number to confirm first." },
          ],
        },
      },
      {
        title: "If you spot or click a phish",
        narration:
          "If you think you have received a phishing email, report it using your company's reporting process or to the security team, rather than just deleting it, and don't forward it to colleagues. If you already clicked a link and entered your password, change your password immediately and tell the security team. Reporting quickly limits the damage, and nobody will blame you for speaking up.",
        visual: {
          type: "steps",
          heading: "What to do",
          steps: [
            "Don't click, reply or forward it to colleagues",
            "Report it to the security team",
            "Clicked and entered your password? Change it immediately",
            "Then tell security straight away",
          ],
        },
      },
      {
        title: "Remember",
        narration:
          "Remember: stop, look, and verify. Slow down when a message creates pressure, check the sender and the links, and confirm anything unusual through a channel you trust. Now let's see what you've learned.",
        visual: { type: "callout", value: "Stop. Look. Verify.", label: "Pressure is a red flag. Check senders and links. Confirm unusual requests another way.", tone: "success", icon: "shield" },
      },
    ],
  },

  // ==========================================================================
  // PASSWORDS & MFA
  // ==========================================================================
  "passwords-mfa": {
    scenes: [
      {
        title: "Welcome",
        narration:
          "Your password is the key to your accounts, and attackers have tools that can guess millions of passwords every second. In this lesson you will learn how to create passwords that are hard to crack, why you should never reuse them, and how multi-factor authentication stops attackers even when a password leaks.",
        visual: { type: "title", heading: "Strong Passwords & MFA", subheading: "Long, unique, and backed by a second factor", icon: "key" },
      },
      {
        title: "Weak vs strong",
        narration:
          "Length beats complexity. A passphrase made of several unrelated words, like correct horse battery staple, is far stronger than a short password with a symbol on the end. Avoid personal details such as your pet's name or your birthday. Attackers find them on social media and try them first.",
        visual: {
          type: "comparison",
          bad: { title: "Weak", items: ["Password123!", "Summer2024", "Your pet's name or birthday", "Qwerty!"] },
          good: { title: "Strong", items: ["correct-horse-battery-staple-91", "Long phrases of unrelated words", "Nothing personal or guessable"] },
        },
      },
      {
        title: "Never reuse passwords",
        narration:
          "Never reuse passwords. When one website is breached, attackers automatically try the stolen email and password on hundreds of other services, including email, banking, and work accounts. This is called credential stuffing. A unique password for every account stops one breach from becoming many.",
        visual: {
          type: "steps",
          heading: "How one breach spreads",
          steps: [
            "A website you use is breached",
            "Attackers get your email and password",
            "They try them on your email, bank and work accounts",
            "Every account sharing that password is now open",
          ],
        },
      },
      {
        title: "Use a password manager",
        narration:
          "Nobody can remember dozens of unique passwords, and you shouldn't have to. Use your company's approved password manager. It creates long random passwords, remembers them for you, and only fills them in on the genuine website. Never write passwords on sticky notes or store them in a text file.",
        visual: {
          type: "checklist",
          heading: "Password manager",
          items: [
            { text: "Generates long, random, unique passwords", good: true },
            { text: "Remembers them so you don't have to", good: true },
            { text: "Only fills them in on the real website", good: true },
            { text: "Sticky notes or a passwords.txt file", good: false },
          ],
        },
      },
      {
        title: "Multi-factor authentication",
        narration:
          "Multi-factor authentication, or MFA, adds a second proof that it's really you, such as a code from an authenticator app or a tap on a security key. Even if your password is stolen, the attacker still can't get in. Hardware security keys and passkeys are the strongest option, because they won't work on a fake login page.",
        visual: {
          type: "steps",
          heading: "How MFA protects you",
          steps: [
            "Enter your password: something you know",
            "Confirm with your phone or security key: something you have",
            "A stolen password alone is no longer enough",
          ],
        },
      },
      {
        title: "Unexpected MFA prompts",
        narration:
          "If you get an MFA prompt that you didn't trigger, someone may already have your password. Deny it, change your password, and report it to security. Attackers sometimes send prompt after prompt, hoping you'll approve one just to make them stop.",
        visual: { type: "callout", value: "Didn't sign in? Deny it.", label: "Then change your password and report it to security.", tone: "danger", icon: "alert" },
      },
      {
        title: "Golden rules",
        narration:
          "A few golden rules. Your password is yours alone. If a colleague needs access while you're away, ask IT to grant it properly, never share your password. Only type your password on the genuine login page that you navigated to yourself. And if a password may have been exposed, or a service reports a breach, change it straight away.",
        visual: {
          type: "checklist",
          heading: "Golden rules",
          items: [
            { text: "Share your password with a colleague covering for you", good: false },
            { text: "Ask IT to grant them their own access", good: true },
            { text: "Log in from a link in an email", good: false },
            { text: "Go to the login page yourself or use a bookmark", good: true },
            { text: "Change it immediately if it may have been exposed", good: true },
          ],
        },
      },
      {
        title: "Remember",
        narration:
          "Long, unique, and protected with MFA. Get those three right, and you've shut the door on most account attacks. Time for the quiz.",
        visual: { type: "callout", value: "Long. Unique. MFA.", label: "Three habits that stop most account takeovers.", tone: "success", icon: "lock" },
      },
    ],
  },

  // ==========================================================================
  // SOCIAL ENGINEERING
  // ==========================================================================
  // Illustrated scenes step forward one beat per narration sentence, so each narration
  // must have exactly as many sentences as its illustration has beats.
  "social-engineering": {
    scenes: [
      {
        title: "Meet Byte",
        narration:
          "Hi, I'm Byte, your security buddy. Today we're talking about social engineering. That's when attackers manipulate people, rather than computers, into handing over information or doing something risky. They exploit our trust, helpfulness, respect for authority, and fear. Let's see what that looks like in real life.",
        visual: { type: "illustration", scene: "se-intro" },
      },
      {
        title: "The fake IT call",
        narration:
          "Meet Sophie. Her phone rings, and the caller says he's Dave from IT. He says her account is about to lock, and he just needs her username and password to fix it. This is a classic trick. Real IT staff will never ask for your password. So Sophie politely refuses, hangs up, and calls the helpdesk herself on the official number.",
        visual: { type: "illustration", scene: "se-phone-call" },
      },
      {
        title: "The levers they pull",
        narration:
          "Social engineers pull a handful of psychological levers. Pretexting means inventing a believable story or identity, like a new starter, an auditor, or a supplier. Authority means posing as a senior leader, so you feel you can't say no. Urgency and fear push you to act before you think. And helpfulness turns your good nature against you, with a quick favour that isn't as innocent as it sounds.",
        visual: { type: "illustration", scene: "se-levers" },
      },
      {
        title: "Tailgating",
        narration:
          "It happens in person too. Sophie taps her badge to open a secure door. A man carrying boxes hurries in right behind her, without a badge. That's called tailgating. The right move is to politely stop him, and direct him to reception, where visitors sign in.",
        visual: { type: "illustration", scene: "se-tailgating" },
      },
      {
        title: "The USB stick in the car park",
        narration:
          "Now imagine finding a USB stick in the car park, labelled Salaries 2025. It's tempting to plug it in and find out whose it is. Don't. Attackers drop infected USB sticks on purpose, and they can install malware the moment they're connected. Hand it to IT or security instead, without ever plugging it in.",
        visual: { type: "illustration", scene: "se-usb-drop" },
      },
      {
        title: "The bank detail change",
        narration:
          "Payment fraud often starts with a polite email. A supplier says their bank details have changed, and asks you to pay the next invoice into a new account. Never change payment details based on an email alone, and don't reply to it to confirm. Instead, call the supplier on a phone number from your existing records. In this case, the real supplier says they never changed anything.",
        visual: { type: "illustration", scene: "se-bank-change" },
      },
      {
        title: "Oversharing online",
        narration:
          "Attackers also research you online. Sophie posts a photo on her first day, with her badge and her screen clearly visible. She adds that she's off to a conference in Berlin all next week. Each detail helps an attacker build a convincing story. Your job title and general news are fine to share, but keep badges, screens, and travel plans off public posts.",
        visual: { type: "illustration", scene: "se-overshare" },
      },
      {
        title: "The golden rule",
        narration:
          "So here's the golden rule. When a request is unusual, verify it through a separate channel you already trust, like a phone number you know, or a quick chat in person. A real colleague or supplier will be glad you checked. An attacker's script simply falls apart. Now let's test what you've learned.",
        visual: { type: "illustration", scene: "se-verify" },
      },
    ],
  },

  // ==========================================================================
  // RANSOMWARE
  // ==========================================================================
  ransomware: {
    scenes: [
      {
        title: "Welcome",
        narration:
          "Ransomware is malicious software that locks or encrypts your files, then demands a payment to restore them. Many attacks now steal data first, and threaten to publish it too. A single click can affect an entire organisation, so let's see how it gets in, and what to do.",
        visual: { type: "title", heading: "Ransomware & Malware Basics", subheading: "How it gets in and how to respond", icon: "bug" },
      },
      {
        title: "How it gets in",
        narration:
          "Most ransomware arrives through phishing: a malicious link, or an attachment such as a document that asks you to enable macros. Don't enable macros unless you're certain a document is legitimate. Other attacks exploit software that hasn't been updated, or hide inside downloads from unofficial websites. Only install software from approved company sources or the official vendor.",
        visual: {
          type: "steps",
          heading: "Common ways in",
          steps: [
            "Phishing emails with malicious links or attachments",
            "Documents asking you to \"Enable macros\"",
            "Unpatched software with known security holes",
            "Downloads from unofficial or cracked software sites",
          ],
        },
      },
      {
        title: "Warning signs",
        narration:
          "Know the early warning signs: files with strange new names or extensions, a sudden slowdown, unexpected pop-ups, or your security software being switched off. And if you think you opened a malicious file but nothing seems wrong, report it anyway. Malware can stay quiet for a while before it strikes.",
        visual: {
          type: "checklist",
          heading: "Warning signs",
          items: [
            { text: "Files with strange new extensions, like report.docx.locked", good: false },
            { text: "Sudden slowdown or heavy disk activity", good: false },
            { text: "Unexpected pop-ups or new programs", good: false },
            { text: "Antivirus or security tools switched off", good: false },
          ],
        },
      },
      {
        title: "If ransomware strikes",
        narration:
          "If a message like this appears, act fast. Disconnect from the network straight away, by unplugging the cable or turning off Wi-Fi, so it can't spread to shared drives and other machines. Then report it to the security team immediately. Don't keep restarting, and don't try to fix it yourself.",
        visual: { type: "callout", value: "Your files are encrypted", label: "Pay 2 BTC within 48 hours or lose everything. Disconnect from the network and report it now.", tone: "danger", icon: "lock" },
      },
      {
        title: "Why not just pay?",
        narration:
          "Paying the ransom is strongly discouraged. There's no guarantee the decryption will work, stolen data may be leaked anyway, it funds criminal groups, and it marks the organisation as a target that pays, inviting repeat attacks.",
        visual: {
          type: "checklist",
          heading: "Why paying is a bad idea",
          items: [
            { text: "No guarantee you get your files back", good: false },
            { text: "Stolen data may still be leaked", good: false },
            { text: "It funds criminal groups", good: false },
            { text: "It invites repeat attacks", good: false },
          ],
        },
      },
      {
        title: "Prevention",
        narration:
          "Prevention is the best cure. Install software updates promptly, because they fix the security holes ransomware exploits. Organisations keep regular, tested backups stored separately from the main network, so they can recover without paying. And you are the first line of defence: think before you click, and report anything suspicious early.",
        visual: {
          type: "steps",
          heading: "Stay protected",
          steps: [
            "Install updates promptly",
            "Regular, tested backups kept separate from the network",
            "Think twice before opening attachments or enabling macros",
            "Report anything suspicious early",
          ],
        },
      },
      {
        title: "Remember",
        narration:
          "If in doubt: disconnect, report, and never pay. Quick action turns a potential disaster into a contained incident. On to the quiz.",
        visual: { type: "callout", value: "Disconnect. Report. Don't pay.", label: "Speed turns a disaster into a contained incident.", tone: "success", icon: "shield" },
      },
    ],
  },

  // ==========================================================================
  // PUBLIC WI-FI & REMOTE WORK
  // ==========================================================================
  "public-wifi-remote-work": {
    scenes: [
      {
        title: "Welcome",
        narration:
          "Working from a café, an airport, or home is convenient, but it brings risks that the office network normally protects you from. This lesson covers public Wi-Fi, prying eyes, and keeping your devices and conversations safe, wherever you work.",
        visual: { type: "title", heading: "Public Wi-Fi & Working Remotely", subheading: "Stay secure wherever you work", icon: "wifi" },
      },
      {
        title: "Public Wi-Fi risks",
        narration:
          "On open public Wi-Fi, attackers on the same network may be able to intercept your traffic, and they set up fake hotspots with convincing names. If a café shows two similar networks, ask the staff which one is genuine. Your phone's personal hotspot is usually a safer choice than public Wi-Fi.",
        visual: {
          type: "comparison",
          bad: { title: "Risky", items: ["Open networks with no password", "Look-alike \"Free WiFi\" hotspots", "Networks you can't confirm with staff"] },
          good: { title: "Safer", items: ["Your phone's personal hotspot", "Network names confirmed with the venue", "The company VPN, always"] },
        },
      },
      {
        title: "Always use the VPN",
        narration:
          "Always connect to the company-approved VPN when you're not on a trusted network. It encrypts everything between your device and the company, so snoopers see nothing useful. Incognito mode does not do this. It only stops your browser from saving your history.",
        visual: {
          type: "steps",
          heading: "Before you start work",
          steps: [
            "Connect to a trusted network or your hotspot",
            "Turn on the company VPN",
            "Then open email and work apps",
          ],
        },
      },
      {
        title: "Protect your screen and device",
        narration:
          "Watch out for shoulder surfing, which means someone reading your screen or watching you type. Sit with your back to a wall, or use a privacy filter. Every time you step away, even for a minute, lock your screen or take your laptop with you. Never ask a stranger to watch it.",
        visual: {
          type: "checklist",
          heading: "In public places",
          items: [
            { text: "Angle your screen or use a privacy filter", good: true },
            { text: "Lock your screen every time you step away", good: true },
            { text: "Leave it unlocked \"just for a minute\"", good: false },
            { text: "Ask a stranger to watch your laptop", good: false },
          ],
        },
      },
      {
        title: "Conversations leak too",
        narration:
          "Conversations leak just as easily as data. Don't discuss confidential client or company details on a crowded train, in a queue, or on speakerphone in a café. Find a private space where you can't be overheard.",
        visual: { type: "callout", value: "Confidential call? Go private.", label: "Not on trains, in queues, or on speakerphone in a café.", tone: "warning", icon: "phone" },
      },
      {
        title: "Secure your home network",
        narration:
          "At home, secure your router. Change its default admin password, since default passwords are widely published online. Protect your Wi-Fi with WPA2 or WPA3 encryption and a strong passphrase, and keep the router's software updated.",
        visual: {
          type: "steps",
          heading: "Home router checklist",
          steps: [
            "Change the default admin password",
            "Use WPA2 or WPA3 with a strong Wi-Fi passphrase",
            "Keep the router's software updated",
          ],
        },
      },
      {
        title: "Lost devices and shared computers",
        narration:
          "If your work laptop or phone is lost or stolen, report it to IT immediately, so they can lock your accounts and wipe the device. And avoid logging in to work systems from shared or public computers, such as a hotel business centre. They may have keyloggers or remember your session. Use your managed work device.",
        visual: {
          type: "checklist",
          heading: "Devices",
          items: [
            { text: "Lost or stolen device? Report it to IT immediately", good: true },
            { text: "Use your managed work device", good: true },
            { text: "Log in to work from a hotel or shared computer", good: false },
          ],
        },
      },
      {
        title: "Remember",
        narration:
          "VPN on, screen locked, voice down. Three habits that keep you safe wherever you work. Let's check your knowledge.",
        visual: { type: "callout", value: "VPN on. Screen locked. Voice down.", label: "Safe habits for working anywhere.", tone: "success", icon: "laptop" },
      },
    ],
  },

  // ==========================================================================
  // SOFTWARE UPDATES & INCIDENT REPORTING
  // ==========================================================================
  "updates-and-reporting": {
    scenes: [
      {
        title: "Welcome",
        narration:
          "Two simple habits stop a huge share of security problems: keeping your devices updated, and reporting incidents quickly. This lesson explains why both matter, and exactly what to do.",
        visual: { type: "title", heading: "Software Updates & Reporting Incidents", subheading: "Patch promptly. Report quickly.", icon: "refresh" },
      },
      {
        title: "Why updates matter",
        narration:
          "Software updates fix security vulnerabilities. Once a fix is published, attackers study it and target every device that hasn't installed it yet. When an approved update asks you to restart, save your work and install it as soon as practical. Don't postpone it indefinitely.",
        visual: {
          type: "steps",
          heading: "The patch race",
          steps: [
            "A security flaw is discovered",
            "The vendor releases a fix as an update",
            "Attackers target devices that haven't updated",
            "Installing the update closes the door",
          ],
        },
      },
      {
        title: "Every device needs updates",
        narration:
          "Updates matter on every device that runs software: laptops and desktops, phones and tablets, browsers and apps, and even routers and other connected devices.",
        visual: {
          type: "checklist",
          heading: "Keep these updated",
          items: [
            { text: "Laptops and desktops", good: true },
            { text: "Phones and tablets", good: true },
            { text: "Browsers and apps", good: true },
            { text: "Routers and other connected devices", good: true },
          ],
        },
      },
      {
        title: "Fake update pop-ups",
        narration:
          "Beware of fake update prompts. A pop-up on a website claiming your browser is out of date, and offering a download, is a common way to deliver malware. Close it, and only update through the software's own settings, or through IT.",
        visual: { type: "callout", value: "Your browser is out of date!", label: "Fake pop-up: close it and update only through official settings or IT.", tone: "warning", icon: "alert" },
      },
      {
        title: "What is a security incident?",
        narration:
          "A security incident is any suspected or actual event that could harm the confidentiality, integrity, or availability of information. That includes a phishing link you clicked, a lost device, or a spreadsheet of customer data emailed to the wrong person. Suspicions count too. If in doubt, report it.",
        visual: {
          type: "checklist",
          heading: "Report things like",
          items: [
            { text: "A suspicious email, link or attachment you opened", good: true },
            { text: "A lost or stolen device", good: true },
            { text: "Customer data emailed to the wrong person", good: true },
            { text: "Anything you're unsure about", good: true },
          ],
        },
      },
      {
        title: "How to report",
        narration:
          "Report quickly. Fast reporting limits the damage, and helps the organisation meet legal deadlines, such as the seventy-two hour breach notification rule under GDPR. Tell the security team what happened, when, which systems or data are involved, and what you've done so far. Don't try to investigate or clean up yourself, because you might destroy evidence.",
        visual: {
          type: "steps",
          heading: "Reporting an incident",
          steps: [
            "Report to the security team immediately",
            "Say what happened, when, and which systems or data are involved",
            "Say what you've done so far",
            "Don't investigate or clean up yourself",
          ],
        },
      },
      {
        title: "No blame for reporting",
        narration:
          "Mistakes happen. What matters is speaking up early. A no-blame reporting culture means people feel safe to report quickly and honestly, and that is what keeps everyone safe. Update promptly, report quickly. Now let's take the quiz.",
        visual: { type: "callout", value: "No blame for reporting", label: "Fast, honest reports keep everyone safe.", tone: "success", icon: "megaphone" },
      },
    ],
  },
}

/** Narration text for every starter lesson, used by the audio generator */
export const LIBRARY_LESSON_SOURCES = LESSONS

export const LIBRARY_LESSONS = withRecordedAudio(LESSONS)
