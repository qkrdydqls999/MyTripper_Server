// 필요한 모듈 가져오기

const fetch = require("node-fetch"); // node-fetch 추가
const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const cors = require("cors");
const bcrypt = require("bcrypt"); // 비밀번호 해싱을 위한 bcrypt 라이브러리
const jwt = require("jsonwebtoken"); // JWT 라이브러리 추가
const path = require("path"); //--

// Express 애플리케이션 생성
const app = express();
const port = 3000; // 서버가 실행될 포트 번호

// Supabase 클라이언트 설정
require("dotenv").config({ path: "./.env" }); // ✅ .env 파일 경로 명시적으로 설정
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
// ⚠️ 실제 서비스에서는 API 키를 .env 파일에 저장하세요!
const supabase = createClient(supabaseUrl, supabaseKey);

// JWT secret key (⚠️ 실제 서비스에서는 더욱 안전한 secret key를 사용하세요!)
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"; // 환경 변수에서 secret key를 가져오거나 기본값 설정

// 미들웨어 설정
app.use(express.json()); // JSON 데이터를 처리할 수 있도록 설정
app.use(
  cors({
    origin: "*",
    methods: "GET,POST,PUT,DELETE",
    allowedHeaders: "Content-Type,Authorization",
    credentials: true,
  })
); // CORS 설정 (프론트엔드와 통신 허용)

// Main02 AI API KEY 호출
//-----------------------------------------------------------
app.get("/api/keys", (req, res) => {
  res.json({
    TOGETHER_API_KEY_JH: process.env.TOGETHER_API_KEY_JH,
    TOGETHER_API_KEY_WG: process.env.TOGETHER_API_KEY_WG,
    TOGETHER_API_KEY_HS: process.env.TOGETHER_API_KEY_HS,
    TOGETHER_API_KEY_IS: process.env.TOGETHER_API_KEY_IS,
    GROQ_API_KEY: process.env.GROQ_API_KEY_JH,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY_JH,
    UNSPLASH_API_KEY: process.env.UNSPLASH_API_KEY_JH,
  });
});
//-----------------------------------------------------------

// 🟢 Gemini API 호출 엔드포인트 추가 (Main03)
app.get("/call-gemini", async (req, res) => {
  const prompt = req.query.prompt;
  const apiKey = process.env.GEMINI_API_KEY_YB;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt가 제공되지 않았습니다." });
  }
  if (!apiKey) {
    return res
      .status(500)
      .json({ error: "Gemini API 키가 서버에 설정되지 않았습니다." });
  }

  const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(geminiApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Gemini API 요청 실패: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    if (
      data.candidates &&
      data.candidates.length > 0 &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts.length > 0
    ) {
      res.json({ result: data.candidates[0].content.parts[0].text });
    } else {
      res.status(500).json({
        error: "Gemini API 응답 형식이 올바르지 않습니다.",
        details: data,
      });
    }
  } catch (error) {
    console.error("Gemini API 호출 오류:", error);
    res.status(500).json({
      error: "Gemini API 호출 중 오류 발생",
      details: error.message,
    });
  }
});

// 🟢 회원가입 API 엔드포인트
app.post("/signup", async (req, res) => {
  const { name, user_id, password, mbti } = req.body; // 요청에서 사용자 데이터 추출

  try {
    // 비밀번호를 해싱 (암호화)하여 저장
    const hashedPassword = await bcrypt.hash(password, 10); // 10은 해싱 강도 (높을수록 보안 강화)

    // Supabase 데이터베이스에 사용자 추가
    const { data, error } = await supabase
      .from("users")
      .insert([{ name, user_id, password: hashedPassword, mbti }]);

    if (error) {
      return res
        .status(400)
        .json({ message: "회원가입 실패", error: error.message });
    }

    res.status(200).json({ message: "회원가입 성공", data }); // 성공 응답 반환
  } catch (error) {
    res.status(500).json({ message: "서버 오류 발생", error: error.message });
  }
});

// 🟢 로그인 API 엔드포인트
app.post("/login", async (req, res) => {
  const { user_id, password } = req.body; // 요청에서 사용자 정보 추출

  try {
    // Supabase에서 해당 사용자 찾기
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("user_id", user_id)
      .single(); // 단일 결과 가져오기

    if (error || !data) {
      return res
        .status(400)
        .json({ message: "로그인 실패: 아이디가 존재하지 않습니다." });
    }

    // 입력된 비밀번호와 데이터베이스에 저장된 해싱된 비밀번호 비교
    const passwordMatch = await bcrypt.compare(password, data.password);
    if (!passwordMatch) {
      return res
        .status(400)
        .json({ message: "로그인 실패: 비밀번호가 일치하지 않습니다." });
    }

    // JWT 생성
    const token = jwt.sign({ userId: data.id }, JWT_SECRET, {
      expiresIn: "1h",
    }); // payload에 사용자 ID 포함, 1시간 만료

    res.status(200).json({ message: "로그인 성공", data: { ...data, token } }); // 성공 응답 반환, 토큰 포함
  } catch (error) {
    res.status(500).json({ message: "서버 오류 발생", error: error.message });
  }
});

// 🟢 로그아웃 API 엔드포인트 (현재는 클라이언트에서 JWT 제거 방식으로 로그아웃, 서버에서는 JWT 무효화/정리 등의 추가 작업 가능)
app.post("/logout", (req, res) => {
  // JWT 기반 인증에서는 서버에서 명시적인 로그아웃 처리가 필수는 아닙니다.
  // 클라이언트 측에서 토큰을 삭제하는 것으로 로그아웃이 완료됩니다.
  // 필요에 따라 서버에서 추가적인 로그아웃 처리 (예: 토큰 무효화, 세션 정리 등)를 할 수 있습니다.
  res.status(200).json({ message: "로그아웃 성공" });
});

// 🟢 MBTI 기반 비밀번호 재설정 요청 API (보안 취약)
app.post("/reset-password-mbti", async (req, res) => {
  const { user_id, mbti } = req.body; // 요청에서 사용자 아이디와 MBTI 추출

  if (!user_id || !mbti) {
    return res
      .status(400)
      .json({ message: "아이디와 MBTI를 모두 입력해주세요." });
  }

  try {
    // Supabase에서 해당 사용자 찾기 (아이디와 MBTI로 확인)
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("user_id", user_id)
      .eq("mbti", mbti) // MBTI 조건 추가
      .single(); // 단일 결과 가져오기

    if (error || !data) {
      return res
        .status(404) // 404 Not Found 에러로 변경 (정보 노출 최소화)
        .json({ message: "사용자 정보를 찾을 수 없습니다." }); // 오류 메시지 변경 (정보 노출 최소화)
    }

    // 인증 성공 (MBTI 일치)
    res.status(200).json({ message: "인증 성공" }); // 성공 응답 반환 (비밀번호 미포함)
  } catch (error) {
    res.status(500).json({ message: "서버 오류 발생", error: error.message });
  }
});

// 🟢 새 비밀번호 설정 API
app.post("/set-new-password", async (req, res) => {
  const { user_id, newPassword } = req.body; // 요청에서 사용자 아이디와 새 비밀번호 추출

  if (!user_id || !newPassword) {
    return res
      .status(400)
      .json({ message: "아이디와 새 비밀번호를 모두 입력해주세요." });
  }

  try {
    // 새 비밀번호 해싱
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Supabase 데이터베이스에 새 비밀번호 업데이트
    const { data, error } = await supabase
      .from("users")
      .update({ password: hashedNewPassword }) // 해싱된 새 비밀번호로 업데이트
      .eq("user_id", user_id); // 아이디 조건

    if (error) {
      return res
        .status(400)
        .json({ message: "비밀번호 재설정 실패", error: error.message });
    }

    res.status(200).json({ message: "비밀번호 재설정 성공" }); // 성공 응답 반환
  } catch (error) {
    res.status(500).json({ message: "서버 오류 발생", error: error.message });
  }
});

// 마이페이지 내 정보 조회
app.get("/myinfo", async (req, res) => {
  const user_id = req.query.id;
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("user_id", user_id)
    .single();

  if (!data || error) {
    return res.status(400).json({
      message: `내 정보 불러오기 실패 : ${user_id} 해당 유저의 정보가 없습니다.`,
    });
  }
  res.send(data);
});

// 마이페이지 내 정보 수정
app.put("/myinfo/modifiy", async (req, res) => {
  const userData = req.body;
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userData.id)
      .single();

    if (!data || error) {
      return res.status(400).json({
        message: `내 정보 수정 실패 : ${userData.id} 해당 유저의 정보가 없습니다.`,
      });
    }
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    // 업데이트 객체 구성
    const updateData = {
      name: userData.name,
      mbti: userData.mbti,
      password: hashedPassword,
    };

    // 사용자 정보 업데이트 (특정 id의 레코드만 업데이트)
    const { data: updatedData, error: updateError } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", userData.id);

    // 인증 성공 (MBTI 일치)
    res.status(200).json({ message: "인증 성공" }); // 성공 응답 반환 (비밀번호 미포함)
  } catch (error) {
    res.status(500).json({ message: "서버 오류 발생", error: error.message });
  }
});

// 후기 게시판 라우트: /api/reviews
app.get("/api/reviews", async (req, res) => {
  try {
    // 페이지네이션
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const start = (page - 1) * limit;
    const end = start + limit - 1;

    // DB 테이블명 "travelplan" (실제로 존재하는지 확인!)
    let query = supabase
      .from("travelplan")
      .select(
        "serial_number, sub_title, content_text, review, plan_mbti, post_day, image_url",
        {
          count: "exact",
        }
      )
      .order("serial_number", { ascending: false })
      .range(start, end);

    const { mbti, search } = req.query;
    if (mbti && mbti !== "MBTI별 게시글") {
      const mbtiArr = mbti.split(",").map((x) => x.trim().toUpperCase());
      query = query.in("plan_mbti", mbtiArr);
    }

    if (search) {
      query = query.or(
        `sub_title.ilike.%${search}%,content_text.ilike.%${search}%`
      );
    }

    const { data, count, error } = await query;
    if (error) throw error;

    res.json({ success: true, data, totalCount: count ?? 0 });
  } catch (err) {
    console.error("후기 게시글 조회 에러:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 정적 파일 서빙
app.use(
  "/review",
  express.static(path.join(__dirname, "..", "MyTripper", "review-hsu"))
);
app.use(
  "/common",
  express.static(path.join(__dirname, "..", "MyTripper", "_common"))
);

// 🟢 서버 실행
app.listen(port, () => {
  console.log(`✅ 서버가 실행 중: http://localhost:${port}`);
});
