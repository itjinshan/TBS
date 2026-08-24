// Server-side string dictionary for every piece of text this backend sends
// back to the client — the chatbot's intake/refine replies, auth
// error/status messages, and validator messages. Distinct from the
// frontend's react-i18next setup (react-frontend/src/i18n), which only
// covers static client-rendered UI (labels, buttons) — this covers text
// that comes back in an API response body, which react-i18next can't reach.
// See CLAUDE.md's Backlog, "Default trip intake to Chinese for the
// China-first launch".
//
// Each entry is either a plain string or a function returning one, for
// entries that interpolate a value (destination name, a place's name, a
// countdown). Every `en` key has a `zh` counterpart — `t()` below falls back
// to `en` if a `zh` entry is ever missing, so a request never gets a raw
// key name back instead of text.

const strings = {
    en: {
        // auth.js
        tooManyLoginAttempts: "Too many login attempts from this network. Please try again later.",
        emailAlreadyExists: "Email already exists",
        registrationSuccess: "Registration successful! Please check your email to verify your account before logging in.",
        userNotFound: "User not found",
        tooManyFailedAttempts: (minutesLeft) => `Too many failed attempts. Please try again in ${minutesLeft} minute(s).`,
        pleaseVerifyEmail: "Please verify your email before logging in. Check your inbox for the verification link.",
        passwordIncorrect: "Password incorrect",
        failedToUpdateProfile: "Failed to update profile",
        missingVerificationToken: "Missing verification token.",
        verificationLinkExpired: "Verification link has expired. Please request a new one.",
        accountNotFound: "Account not found.",
        emailAlreadyVerified: "Your email is already verified. You can log in.",
        emailVerifiedSuccess: "Your email has been verified. You can now log in.",
        errorVerifyingEmail: "Error verifying email. Please try again.",
        emailNotFound: "Email not found.",
        accountAlreadyVerified: "This account is already verified. Please log in.",
        newVerificationLinkSent: "A new verification link has been sent to your email.",
        forgotPasswordSendError: "An error has occurred while sending the password reset link, please try again.",
        passwordResetLinkSent: "A password reset link was successfully sent to your email, please follow the link to reset your password.",
        resetLinkExpired: "Reset link has expired. Please request a new link.",
        resetPasswordUserError: "Error has occurred while resetting new password. Try again later.",
        resetPasswordDbError: "Error has occurred while updating new password to Database. Try again later.",
        passwordUpdatedSuccess: "Password has been updated successfully.",
        createPasswordLinkExpired: "Link has expired. Please request a new link.",
        createPasswordUserError: "Error has occurred while creating new password. Try again later.",
        createPasswordDbError: "Error has occurred while updating new password to Database. Try again later.",

        // Validation/*.js
        emailInvalid: "Email field is invalid",
        passwordRequired: "Password field is required",
        emailRequired: "Email field is required",
        firstNameRequired: "Please enter your first name.",
        lastNameRequired: "Please enter your last name.",
        passwordLength: "Password must be between 6 and 30 characters.",
        confirmPasswordRequired: "Confirm Password field is required.",
        passwordsMustMatch: "Passwords must match.",

        // trip.js — intake stage questions (OTHER_PREF_QUESTIONS)
        questionDuration: "How many days are you planning to travel?",
        questionStartDate: "When are you planning to start the trip?",
        questionNumOfTravelers: "How many people will be traveling?",
        questionBudget: "What's your budget style — budget, mid-range, or luxury?",
        questionPace: "What pace are you after — relaxed, standard, or packed?",
        questionTransportMode: "How will you mostly be getting around — walking, public transit, taxi, or driving?",
        questionArrivalPoint: "Where will you be arriving into the destination from (airport, train station, etc.)?",
        questionDeparturePoint: "And where will you be departing from at the end of the trip?",

        // trip.js — intake stage replies
        addressNotVerified: "Address not verified — lookup unavailable",
        suggestedStay: (n, destination) => `Suggested stay #${n} in ${destination}`,
        addressPending: "Address pending — DS-Service unavailable",
        accommodationSettleIntro: "Now let's settle your accommodation — here are some options near where you'll actually be visiting:",
        accommodationSettleOutro: "Which one would you like to go with? (you can also click a marker on the map)",
        intakeGenericError: "Something went wrong while processing that — please try again.",
        accommodationListingSimilar: "Here are some similar hotels, could you please confirm:",
        accommodationListingConfirm: (query) => `Here's what I found for "${query}", could you please confirm:`,
        accommodationListingOutro: "Which one is yours? (reply with the name or number, or type the name again to search differently)",
        destinationConfirmed: (destination) => `Got it — ${destination}. Do you already have a place to stay booked or in mind?`,
        whereHeaded: "Where are you headed?",
        placeNameAsk: "Great — what's the name (and city, if it helps) of the place? I'll look it up.",
        budgetLivingPrefAsk: "No problem — what's your lodging budget (budget, mid-range, or luxury), and any living preferences (e.g. central location, quiet neighborhood, hotel vs. apartment)?",
        confirmHavePlace: "Just to confirm — do you already have a place booked or in mind? (yes/no)",
        gotItThenQuestion: (name, question) => `Got it — ${name}. ${question}`,
        gotItReadyNoQuestions: (name) => `Got it — ${name}. I've got everything I need — hit Generate Itinerary whenever you're ready!`,
        gotItQuestion: (question) => `Got it. ${question}`,
        willGenerateFirst: "Don't worry — we'll generate the itinerary first, then recommend a more suitable hotel based on where you'll actually be visiting. Hit Generate Itinerary whenever you're ready!",
        readyToGenerate: "I've got everything I need — hit Generate Itinerary whenever you're ready!",

        // trip.js — /generate and CRUD errors
        missingDestination: "Missing required field: destination",
        missingOriginDestination: "Missing required field: origin/destination ([lng, lat])",
        failedToSaveTrip: "Failed to save trip",
        tripNotFound: "Trip not found",
        failedToUpdateTrip: "Failed to update trip",
        failedToLoadHistory: "Failed to load trip history",
        invalidTripId: "Invalid trip id",

        // trip.js — /refine (REFINE_STAGES)
        missingItinerary: "Missing required field: itinerary",
        refineGenericError: "Something went wrong while processing that — please try again.",
        refineWhatToChange: "Sure — what would you like to change? (e.g. \"swap day 2's museum for something more outdoorsy\")",
        refineEnjoyTrip: "Great — enjoy your trip!",
        refineConfirmChangeAnything: "Just to confirm — would you like to change anything about this plan? (yes/no)",
        refinePickAccommodation: "Which of those would you like to go with? (reply with the name or number, or click a marker on the map)",
        refineGreatChoice: (name) => `Great choice — ${name}. I've updated your itinerary's routes around it. Anything else you'd like to change?`,
        refineWhichDayWhatChange: "Which day is this for, and what would you like changed? (e.g. \"day 2, swap the museum for something more outdoorsy\")",
        refineAnythingElseSuffix: " Anything else you'd like to change?",
        refineWantToChangeAnything: "Want to change anything about this plan? (yes/no)",

        // Services/itineraryPlanner.js's replaceSpotInDay() — reaches the
        // /refine response the same way the trip.js strings above do.
        swapDayNotFound: (dayNumber, totalDays) => `I couldn't find day ${dayNumber} in this itinerary — this trip only has ${totalDays} day${totalDays === 1 ? '' : 's'}.`,
        swapSpotNotFound: (dayNumber) => `I couldn't tell which spot on day ${dayNumber} you meant — could you name it more specifically?`,
        swapNoReplacement: (targetSpotName) => `I couldn't find a good replacement for ${targetSpotName} right now — try a different category, or try again in a moment.`,
        swapSuccess: (targetSpotName, replacementName, dayNumber) => `Swapped ${targetSpotName} for ${replacementName} on day ${dayNumber}.`
    },

    zh: {
        // auth.js
        tooManyLoginAttempts: "该网络的登录尝试次数过多，请稍后再试。",
        emailAlreadyExists: "该邮箱已被注册",
        registrationSuccess: "注册成功！请查收邮件并验证账号后再登录。",
        userNotFound: "未找到该用户",
        tooManyFailedAttempts: (minutesLeft) => `登录失败次数过多，请在 ${minutesLeft} 分钟后再试。`,
        pleaseVerifyEmail: "请先验证邮箱后再登录，验证链接已发送至你的邮箱。",
        passwordIncorrect: "密码错误",
        failedToUpdateProfile: "更新资料失败",
        missingVerificationToken: "缺少验证令牌。",
        verificationLinkExpired: "验证链接已过期，请重新申请。",
        accountNotFound: "未找到该账号。",
        emailAlreadyVerified: "您的邮箱已验证，可以登录了。",
        emailVerifiedSuccess: "您的邮箱已验证成功，现在可以登录了。",
        errorVerifyingEmail: "验证邮箱时出错，请重试。",
        emailNotFound: "未找到该邮箱。",
        accountAlreadyVerified: "该账号已验证，请直接登录。",
        newVerificationLinkSent: "新的验证链接已发送至你的邮箱。",
        forgotPasswordSendError: "发送密码重置链接时出错，请重试。",
        passwordResetLinkSent: "密码重置链接已成功发送至你的邮箱，请点击链接重置密码。",
        resetLinkExpired: "重置链接已过期，请重新申请。",
        resetPasswordUserError: "重置密码时出错，请稍后再试。",
        resetPasswordDbError: "更新密码到数据库时出错，请稍后再试。",
        passwordUpdatedSuccess: "密码已成功更新。",
        createPasswordLinkExpired: "链接已过期，请重新申请。",
        createPasswordUserError: "设置密码时出错，请稍后再试。",
        createPasswordDbError: "更新密码到数据库时出错，请稍后再试。",

        // Validation/*.js
        emailInvalid: "邮箱格式无效",
        passwordRequired: "请输入密码",
        emailRequired: "请输入邮箱",
        firstNameRequired: "请输入名字。",
        lastNameRequired: "请输入姓氏。",
        passwordLength: "密码长度需为 6 到 30 位。",
        confirmPasswordRequired: "请输入确认密码。",
        passwordsMustMatch: "两次输入的密码不一致。",

        // trip.js — intake stage questions
        questionDuration: "你计划旅行几天？",
        questionStartDate: "你计划什么时候出发？",
        questionNumOfTravelers: "一共几位出行？",
        questionBudget: "你的预算风格是——经济型、舒适型还是豪华型？",
        questionPace: "你希望的节奏是——轻松、标准还是紧凑？",
        questionTransportMode: "你主要打算怎么出行——步行、公共交通、出租车还是自驾？",
        questionArrivalPoint: "你会从哪里抵达目的地（机场、火车站等）？",
        questionDeparturePoint: "行程结束时你会从哪里出发离开？",

        // trip.js — intake stage replies
        addressNotVerified: "地址未验证——暂时无法查询",
        suggestedStay: (n, destination) => `${destination} 推荐住宿 #${n}`,
        addressPending: "地址待补充——DS-Service 暂不可用",
        accommodationSettleIntro: "现在来确定你的住宿吧——这里是一些在你实际游览区域附近的选项：",
        accommodationSettleOutro: "你想选哪一个？（也可以点击地图上的标记）",
        intakeGenericError: "处理时出了点问题，请重试。",
        accommodationListingSimilar: "这里有一些类似的酒店，请确认一下：",
        accommodationListingConfirm: (query) => `这是为“${query}”找到的结果，请确认一下：`,
        accommodationListingOutro: "哪一个是你要的？（回复名称或编号，或重新输入名称进行搜索）",
        destinationConfirmed: (destination) => `好的——${destination}。你是否已经预订好或看中了住宿？`,
        whereHeaded: "你打算去哪里？",
        placeNameAsk: "好的——这个地方的名称是什么（如果有帮助的话，也可以告诉我城市）？我来帮你查一下。",
        budgetLivingPrefAsk: "没问题——你的住宿预算是多少（经济型、舒适型还是豪华型），有什么居住偏好吗（比如市中心位置、安静的街区、酒店还是公寓）？",
        confirmHavePlace: "确认一下——你是否已经预订好或看中了住宿？（是/否）",
        gotItThenQuestion: (name, question) => `好的——${name}。${question}`,
        gotItReadyNoQuestions: (name) => `好的——${name}。我已经掌握了所有需要的信息——准备好后点击生成行程！`,
        gotItQuestion: (question) => `好的。${question}`,
        willGenerateFirst: "别担心——我们会先生成行程，再根据你实际的游览区域推荐更合适的酒店。准备好后点击生成行程！",
        readyToGenerate: "我已经掌握了所有需要的信息——准备好后点击生成行程！",

        // trip.js — /generate and CRUD errors
        missingDestination: "缺少必填字段：目的地",
        missingOriginDestination: "缺少必填字段：起点/终点（[经度, 纬度]）",
        failedToSaveTrip: "保存行程失败",
        tripNotFound: "未找到该行程",
        failedToUpdateTrip: "更新行程失败",
        failedToLoadHistory: "加载行程历史失败",
        invalidTripId: "无效的行程 ID",

        // trip.js — /refine (REFINE_STAGES)
        missingItinerary: "缺少必填字段：行程",
        refineGenericError: "处理时出了点问题，请重试。",
        refineWhatToChange: "好的——你想改什么？（例如“把第 2 天的博物馆换成更户外一点的活动”）",
        refineEnjoyTrip: "太好了——祝你旅途愉快！",
        refineConfirmChangeAnything: "确认一下——你想调整这个计划的哪些部分吗？（是/否）",
        refinePickAccommodation: "你想选哪一个？（回复名称或编号，或点击地图上的标记）",
        refineGreatChoice: (name) => `不错的选择——${name}。我已经根据它更新了行程路线。还有什么想调整的吗？`,
        refineWhichDayWhatChange: "是第几天，想改成什么？（例如“第 2 天，把博物馆换成更户外一点的活动”）",
        refineAnythingElseSuffix: " 还有什么想调整的吗？",
        refineWantToChangeAnything: "想调整这个计划的哪些部分吗？（是/否）",

        swapDayNotFound: (dayNumber, totalDays) => `没有找到第 ${dayNumber} 天——这次行程一共只有 ${totalDays} 天。`,
        swapSpotNotFound: (dayNumber) => `不太确定你说的是第 ${dayNumber} 天的哪个地点，能再具体描述一下吗？`,
        swapNoReplacement: (targetSpotName) => `暂时没能为“${targetSpotName}”找到合适的替换地点——可以换个类别试试，或稍后再试。`,
        swapSuccess: (targetSpotName, replacementName, dayNumber) => `已将第 ${dayNumber} 天的“${targetSpotName}”替换为“${replacementName}”。`
    }
};

// Falls back to English if `lang` isn't 'zh', or if the key is somehow
// missing from `zh` — every caller gets a real string, never `undefined`.
function t(lang, key, ...params) {
    const dict = (lang === 'zh' ? strings.zh : strings.en);
    const entry = dict[key] !== undefined ? dict[key] : strings.en[key];
    return typeof entry === 'function' ? entry(...params) : entry;
}

module.exports = { t };
