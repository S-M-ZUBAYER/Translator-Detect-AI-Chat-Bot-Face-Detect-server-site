// const express=require("express");
// const cors=require("cors");
// require("dotenv").config();
// const router = express.Router();
// const port=process.env.PORT || 5000;


// const app=express();
// app.use(cors());
// app.use(express.json());

// router.get('/',(req,res)=>{
//     res.send("I am running as the server site of ZUSS Detect")
// })

// const OpenAI = require("openai");

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// });


// router.post("/detect",(req,res)=>{
//     const  question =req.body.question;
// const address= `${question} +" "+ 请告诉哪个是公司名字，公司税号，公司地址，公司电话，公司开户行，公司账号，哪个是备注`

// openai.createCompletion({
//         model: "text-davinci-003",
//         prompt: address,
//         max_tokens: 1500,
//         temperature:0.7,
//     }).then((response)=>{
//         console.log(response?.choices?.[0]?.text);
//         return response?.data?.choices?.[0]?.text;
//     })
//     .then((answer)=>{
//         console.log({answer});
//         const array=answer?.split("\n").filter((value)=>value).map((value)=>value.trim());
//         return array;
//     })
//     .then((answer)=>{
//         res.json({
//             answer: answer,
//             prompt: question
//         })
//     })
// })




// module.exports=router;


const express = require("express");
const cors = require("cors");
require("dotenv").config();
const router = express.Router();
const port = process.env.PORT || 5000;

const app = express();
app.use(cors());
app.use(express.json());

router.get('/', (req, res) => {
    res.send("I am running as the server site of ZUSS Detect");
});

const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * @swagger
 * /detect:
 *   post:
 *     summary: Extract company fields from raw text
 *     description: >
 *       Sends raw text (e.g. invoice or business card content) to GPT and asks it
 *       to identify company name, tax number, address, phone, bank, account number,
 *       and remarks in Chinese.
 *     tags: [Detect]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [question]
 *             properties:
 *               question:
 *                 type: string
 *                 example: "广州某贸易有限公司 税号:91440101MA9XXXXX 地址:广州市天河区..."
 *     responses:
 *       200:
 *         description: Successfully extracted company fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 answer:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["公司名字：广州某贸易有限公司", "公司税号：91440101MA9XXXXX"]
 *                 prompt:
 *                   type: string
 *                   example: "广州某贸易有限公司 税号:91440101MA9XXXXX..."
 *       500:
 *         description: Internal server error
 */
router.post("/detect", (req, res) => {
    const question = req.body.question;
    const address = `${question} +" "+ 请告诉哪个是公司名字，公司税号，公司地址，公司电话，公司开户行，公司账号，哪个是备注`;

    openai.createCompletion({
        model: "text-davinci-003",
        prompt: address,
        max_tokens: 1500,
        temperature: 0.7,
    })
        .then((response) => response?.data?.choices?.[0]?.text)
        .then((answer) => {
            const array = answer?.split("\n").filter((value) => value).map((value) => value.trim());
            return array;
        })
        .then((answer) => {
            res.json({ answer, prompt: question });
        });
});

module.exports = router;