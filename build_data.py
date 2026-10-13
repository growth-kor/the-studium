#!/usr/bin/env python3
import json, re, os, glob, base64
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
try:
    import pypinyin
except ImportError:
    pypinyin = None

BASE_PARENT = os.path.dirname(os.path.abspath(__file__))
# If 00_모바일_학습웹_배포 is inside _학교_활동, the sibling folders are in the same directory!
if os.path.exists(os.path.join(os.path.dirname(BASE_PARENT), "01_월요일")):
    ROOT_DIR = os.path.dirname(BASE_PARENT)
elif os.path.exists(os.path.join(os.path.dirname(os.path.dirname(BASE_PARENT)), "_학교_활동", "01_월요일")):
    ROOT_DIR = os.path.join(os.path.dirname(os.path.dirname(BASE_PARENT)), "_학교_활동")
else:
    ROOT_DIR = os.path.dirname(os.path.dirname(BASE_PARENT))
OUTPUT_FILE = os.path.join(ROOT_DIR, '00_모바일_학습웹_배포', 'data.js')

def clean_row(text):
    placeholder = '@@PIPE@@'
    t = text.replace(r'\|', placeholder)
    parts = t.split('|')
    parts = [p.replace(placeholder, '|').strip() for p in parts]
    return parts

# ==============================================================================
# 0. PARSE 2026-2_중국어_통합_어휘사전 (MASTER DICTIONARY)
# ==============================================================================
dict_file = os.path.join(ROOT_DIR, '01_월요일', '2026-2_중국어_통합_어휘사전.md')
master_dict = {}
if os.path.exists(dict_file):
    with open(dict_file, 'r', encoding='utf-8') as f:
        dict_content = f.read()
    dict_pattern = r'###\s+([^\n]+)\n\*\s+\*\*발음\*\*:\s*([^\n]+)\n\*\s+\*\*품사\*\*:\s*([^\n]+)\n\*\s+\*\*한국어 뜻\*\*:\s*([^\n]+)\n\*\s+\*\*HSK 등급\*\*:\s*([^\n]+)(?:\n\*\s+\*\*상세\*\*:\s*([^\n]+))?'
    for zh, py, pos, kr, level, note in re.findall(dict_pattern, dict_content):
        clean_zh = zh.strip()
        clean_level = re.sub(r'[🟢🟡🔴⭐]', '', level).strip()
        master_dict[clean_zh] = {
            "zh": clean_zh,
            "py": py.strip(),
            "pos": pos.strip(),
            "kr": kr.strip(),
            "level": clean_level,
            "note": note.strip() if note else ""
        }

local_dict_file = os.path.join(ROOT_DIR, '00_모바일_학습웹_배포', 'data', 'dict', 'master_dict.json')
if os.path.exists(local_dict_file):
    try:
        with open(local_dict_file, 'r', encoding='utf-8') as f:
            existing_dict = json.load(f)
            for k, v in existing_dict.items():
                if k not in master_dict:
                    master_dict[k] = v
    except Exception:
        pass

# ==============================================================================
# 1. PARSE 《背影》 ALL-IN-ONE
# ==============================================================================
beiying_file = os.path.join(ROOT_DIR, '01_월요일', '02_5~6교시_중국어B1(통합실습)', '00_중간고사_All-in-One_마스터 (MD)', '[All-in-One]_산문_背影_완벽대비_종합학습노트.md')
with open(beiying_file, 'r', encoding='utf-8') as f:
    by_content = f.read()

by_paragraphs = []
lines = by_content.split('\n')
cur_p_num = 0
cur_p_title = ""
in_3col = False
in_vocab = False
p_sentences = []
p_vocab = []

for line in lines:
    m = re.match(r'^### 제(\d)문단:\s*(.*)', line)
    if m:
        if cur_p_num > 0:
            by_paragraphs.append({
                "paragraph": cur_p_num,
                "title": cur_p_title,
                "sentences": p_sentences,
                "vocab": p_vocab
            })
            p_sentences = []
            p_vocab = []
        cur_p_num = int(m.group(1))
        cur_p_title = m.group(2).strip()
        in_3col = False
        in_vocab = False
        continue

    if cur_p_num > 0:
        if '1) 3단 대역 정독' in line:
            in_3col = True
            in_vocab = False
            continue
        elif '2) 🔍 제' in line and '어휘 사전' in line:
            in_3col = False
            in_vocab = True
            continue
        elif line.startswith('### ') or line.startswith('## '):
            in_3col = False
            in_vocab = False

        if in_3col and line.startswith('|') and not line.startswith('| 단어') and not line.startswith('| :---') and not line.startswith('| ---'):
            parts = clean_row(line)
            if len(parts) >= 5:
                zh = re.sub(r'\[\[.*?(?:\\\||\|)(.*?)\]\]', r'\1', parts[1])
                zh = re.sub(r'\[\[(.*?)\]\]', r'\1', zh).strip()
                py = parts[2].strip()
                kr = parts[3].strip()
                if zh and py:
                    p_sentences.append({"zh": zh, "py": py, "kr": kr})
        elif in_vocab and line.startswith('|') and not line.startswith('| 어휘') and not line.startswith('| :---') and not line.startswith('| ---'):
            parts = clean_row(line)
            if len(parts) >= 6:
                zh = re.sub(r'\[\[.*?(?:\\\||\|)(.*?)\]\]', r'\1', parts[1])
                zh = re.sub(r'\[\[(.*?)\]\]', r'\1', zh).replace('**', '').strip()
                py = parts[2].replace('`', '').strip()
                pos = parts[3].strip()
                kr = parts[4].replace('**', '').strip()
                level = parts[5].strip() if len(parts) > 5 else ""
                note = parts[6].strip() if len(parts) > 6 else ""
                if zh and py and zh not in ('단어', '단어 (간체자)'):
                    clean_lvl = re.sub(r'[🟢🟡🔴⭐]', '', level).strip()
                    p_vocab.append({"zh": zh, "py": py, "pos": pos, "kr": kr, "level": clean_lvl, "note": note})
                    if zh in master_dict:
                        master_dict[zh]['note'] = note
                        if clean_lvl:
                            master_dict[zh]['level'] = clean_lvl
                    else:
                        master_dict[zh] = {"zh": zh, "py": py, "pos": pos, "kr": kr, "level": clean_lvl, "note": note}

if cur_p_num > 0:
    by_paragraphs.append({
        "paragraph": cur_p_num,
        "title": cur_p_title,
        "sentences": p_sentences,
        "vocab": p_vocab
    })

# Grammar
by_grammar = []
m_g = re.search(r'## 4\. 핵심 어법 및 구문 심층 정리\n(.*?)(?=\n## 5\.|\Z)', by_content, re.DOTALL)
if m_g:
    for b in re.split(r'###\s+', m_g.group(1).strip()):
        if b.strip():
            blines = b.strip().split('\n')
            by_grammar.append({"title": blines[0].strip(), "desc": '\n'.join(blines[1:]).strip()})

# Q&A
by_qa = []
m_q = re.search(r'## 5\. 정혜선 교수님 중간고사 적중 예상 Q&A.*?\n(.*?)(?=\n---|\Z)', by_content, re.DOTALL)
if m_q:
    for b in re.split(r'###\s+', m_q.group(1).strip()):
        if b.strip():
            blines = b.strip().split('\n')
            q_title = blines[0].strip()
            a_text = '\n'.join([l.replace('> ', '').replace('>', '').strip() for l in blines[1:] if l.strip()])
            by_qa.append({"question": q_title, "answer": a_text})

# ==============================================================================
# 2. PARSE 《团圆》 ALL-IN-ONE
# ==============================================================================
tuanyuan_file = os.path.join(ROOT_DIR, '01_월요일', '02_5~6교시_중국어B1(통합실습)', '00_중간고사_All-in-One_마스터 (MD)', '[All-in-One]_동화책_团圆_완벽대비_종합학습노트.md')
with open(tuanyuan_file, 'r', encoding='utf-8') as f:
    ty_content = f.read()

ty_scenes = []
matches_ty = re.findall(r'## (\d+)\.\s*(.*?)\n.*?### 🇨🇳 중국어 원문\n(.*?)\n### 🗣️ 병음.*?\n(.*?)\n### 🇰🇷 정밀 한국어 번역\n(.*?)(?=\n### 💡|\n## |\Z)', ty_content, re.DOTALL)
for m in matches_ty:
    num, title, zh, py, kr = m
    zh = re.sub(r'\[\[.*?(?:\\\||\|)(.*?)\]\]', r'\1', zh)
    zh = re.sub(r'\[\[(.*?)\]\]', r'\1', zh).replace('**', '').strip()
    py = py.replace('***', '').replace('**', '').replace('*', '').strip()
    kr = kr.replace('***', '').replace('**', '').strip()
    ty_scenes.append({
        "scene": int(num),
        "title": title.strip(),
        "zh": zh,
        "py": py,
        "kr": kr
    })

# Tuanyuan 10-line Review
ty_review = []
m_rev_zh = re.search(r'### 🇨🇳 중국어 감상문 \(10줄 표준 작성본\)\n+(.*?)(?=\n### 🗣️|\Z)', ty_content, re.DOTALL)
m_rev_py = re.search(r'### 🗣️ 한어병음 \(Pinyin\)\n+(.*?)(?=\n### 🇰🇷|\Z)', ty_content, re.DOTALL)
m_rev_kr = re.search(r'### 🇰🇷 한국어 정밀 번역\n+(.*?)(?=\n---|\Z)', ty_content, re.DOTALL)

if m_rev_zh and m_rev_py and m_rev_kr:
    zh_lines = [re.sub(r'^\d+\.\s*', '', re.sub(r'\[\[.*?(?:\\\||\|)(.*?)\]\]', r'\1', l)) for l in m_rev_zh.group(1).strip().split('\n') if l.strip()]
    zh_lines = [re.sub(r'\[\[(.*?)\]\]', r'\1', l).strip() for l in zh_lines]
    py_lines = [re.sub(r'^\d+\.\s*\**', '', l).replace('*', '').strip() for l in m_rev_py.group(1).strip().split('\n') if l.strip()]
    kr_lines = [re.sub(r'^\d+\.\s*', '', l).strip() for l in m_rev_kr.group(1).strip().split('\n') if l.strip()]
    for i in range(min(len(zh_lines), len(py_lines), len(kr_lines))):
        ty_review.append({"zh": zh_lines[i], "py": py_lines[i], "kr": kr_lines[i]})

# Tuanyuan Q&A
ty_qa = []
m_tqa = re.search(r'## 🎓 정혜선 교수님 기습 질문 대비 3대 핵심 Q&A 족보\n(.*?)(?=\n## |\Z)', ty_content, re.DOTALL)
if m_tqa:
    q_blocks = re.split(r'###\s+Q\d+\.\s*', m_tqa.group(1).strip())
    for b in q_blocks:
        if b.strip():
            blines = b.strip().split('\n')
            q_title = blines[0].strip()
            a_text = '\n'.join([l.replace('> ', '').replace('>', '').replace('**', '').strip() for l in blines[1:] if l.strip()])
            ty_qa.append({"question": q_title, "answer": a_text})

# ==============================================================================
# 3. PARSE 《雨的四季》
# ==============================================================================
rain_file = os.path.join(ROOT_DIR, '01_월요일', '02_5~6교시_중국어B1(통합실습)', '00_중간고사_All-in-One_마스터 (MD)', '01_강독마스터_雨的四季(사계절_전편)_통합본.md')
with open(rain_file, 'r', encoding='utf-8') as f:
    r_content = f.read()

rain_sections = []
r_matches = re.findall(r'### ([^\n]+)\n+```text\n(.*?)\n```', r_content, re.DOTALL)
for raw_title, block in r_matches:
    title_clean = raw_title.strip()
    # parse paragraphs inside code block
    paras = block.strip().split('\n\n')
    sec_sentences = []
    for p in paras:
        plines = [l.strip() for l in p.strip().split('\n') if l.strip()]
        if len(plines) >= 3:
            zh = plines[0]
            py = plines[1]
            kr = plines[2].lstrip('[').rstrip(']')
            sec_sentences.append({"zh": zh, "py": py, "kr": kr})
        elif len(plines) == 2:
            sec_sentences.append({"zh": plines[0], "py": plines[1], "kr": ""})
    rain_sections.append({
        "title": title_clean,
        "sentences": sec_sentences
    })

# ==============================================================================
# 4. PARSE 《신개념 중국어 3》 (전20과 본책 공식 본문 전수 탑재)
# ==============================================================================
# 교재 본책(16~92p 및 부록 98~104p)에 실린 전20과 공식 본문 스토리 및 완벽 대역
chinese3_sections = [
    {
        "id": 1,
        "title": "제1과 《第一次上路》",
        "short_title": "1과 第一次上路",
        "sentences": [
            {
                "zh": "今天我第一次开车上路，既紧张又兴奋。",
                "py": "Jīntiān wǒ dì-yī cì kāichē shànglù, jì jǐnzhāng yòu xīngfèn.",
                "kr": "오늘 내가 처음으로 운전대를 잡고 도로에 나섰는데, 긴장도 되고 흥분도 되었다."
            },
            {
                "zh": "到了一个路口，红灯亮了，我把车停了下来。",
                "py": "Dàole yí ge lùkǒu, hóngdēng liàng le, wǒ bǎ chē tíngle xiàlai.",
                "kr": "교차로에 도착하자 빨간불이 켜졌고, 나는 차를 멈추어 세웠다."
            },
            {
                "zh": "过了一会儿，绿灯亮了，可是我的车熄火了。",
                "py": "Guòle yíhuìr, lǜdēng liàng le, kěshì wǒ de chē xīhuǒ le.",
                "kr": "잠시 후 초록불이 켜졌지만, 내 차는 시동이 꺼져버렸다."
            },
            {
                "zh": "又过了一会儿，绿灯变成了黄灯，黄灯又变成了红灯，我的车还是动不了。",
                "py": "Yòu guòle yíhuìr, lǜdēng biànchéngle huángdēng, huángdēng yòu biànchéngle hóngdēng, wǒ de chē háishi dòngbuliǎo.",
                "kr": "또 잠시 후 초록불이 노란불로 바뀌고, 노란불이 다시 빨간불로 바뀌었지만, 내 차는 여전히 움직이지 않았다."
            },
            {
                "zh": "这个时候一位警察走过来，说：“小姐，你还没有等到你喜欢的颜色吗？”",
                "py": "Zhè ge shíhou yí wèi jǐngchá zǒuguòlai, shuō: “Xiǎojiě, nǐ hái méiyǒu děngdào nǐ xǐhuan de yánsè ma?”",
                "kr": "이때 한 경찰관이 다가와 말했다: “아가씨, 아직 마음에 드는 색깔을 못 기다리셨나요?”"
            }
        ]
    },
    {
        "id": 2,
        "title": "제2과 《您找我有事儿吗》",
        "short_title": "2과 您找我有事儿吗",
        "sentences": [
            {
                "zh": "一辆公共汽车在马路上行驶。",
                "py": "Yí liàng gōnggòng qìchē zài mǎlù shang xíngshǐ.",
                "kr": "버스 한 대가 큰길 위를 달리고 있었다."
            },
            {
                "zh": "江日新坐在后面，戴着耳机，听着音乐，望着窗外的风景。",
                "py": "Jiāng Rìxīn zuò zài hòumian, dàizhe ěrjī, tīngzhe yīnyuè, wàngzhe chuāngwài de fēngjǐng.",
                "kr": "장르신은 뒤쪽에 앉아 이어폰을 끼고 음악을 들으며 창밖 풍경을 바라보고 있었다."
            },
            {
                "zh": "突然一个急刹车，江日新一下子扑到了前面，倒在司机旁边。",
                "py": "Tūrán yí ge jí shāchē, Jiāng Rìxīn yíxiàzi pūdàole qiánmian, dǎo zài sījī pángbiān.",
                "kr": "갑작스러운 급정거로 인해 장르신은 단숨에 앞으로 확 쏠려 기사님 옆에 쓰러졌다."
            },
            {
                "zh": "车停了下来，他爬起来看着司机。",
                "py": "Chē tíngle xiàlai, tā páqǐlai kànzhe sījī.",
                "kr": "차가 멈추어 서자, 그는 기어 일어나 기사님을 쳐다보았다."
            },
            {
                "zh": "大家都以为，他要跟司机吵一架。",
                "py": "Dàjiā dōu yǐwéi, tā yào gēn sījī chǎo yí jià.",
                "kr": "모두들 그가 기사님과 한바탕 말다툼을 벌일 것이라 생각했다."
            },
            {
                "zh": "没想到，江日新却笑了笑，对司机说：“师傅，您找我有事儿吗？”",
                "py": "Méi xiǎngdào, Jiāng Rìxīn què xiàole xiào, duì sījī shuō: “Shīfu, nín zhǎo wǒ yǒu shìr ma?”",
                "kr": "뜻밖에도 장르신은 빙그레 웃으며 기사님에게 말했다: “기사님, 저한테 무슨 볼일 있으신가요?”"
            }
        ]
    },
    {
        "id": 3,
        "title": "제3과 《一片绿叶》",
        "short_title": "3과 一片绿叶",
        "sentences": [
            {
                "zh": "有个女孩儿得了重病，她每天望着窗外的一棵大树。",
                "py": "Yǒu ge nǚháir déle zhòngbìng, tā měitiān wàngzhe chuāngwài de yì kē dàshù.",
                "kr": "중병에 걸린 한 소녀가 매일 창밖의 큰 나무 한 그루를 바라보고 있었다."
            },
            {
                "zh": "秋天来了，树叶一片片落了下来。",
                "py": "Qiūtiān lái le, shùyè yípiànpiàn luòle xiàlai.",
                "kr": "가을이 오자 나뭇잎들이 한 장 한 장 떨어져 내렸다."
            },
            {
                "zh": "她很伤心：“树叶掉光了，我的生命也就结束了。”",
                "py": "Tā hěn shāngxīn: “Shùyè diàoguāng le, wǒ de shēngmìng yě jiù jiéshù le.”",
                "kr": "소녀는 몹시 슬퍼하며 말했다: “나뭇잎이 다 떨어지면 내 생명도 끝나버릴 거야.”"
            },
            {
                "zh": "一位老画家知道了女孩儿的心思，决定帮助她，就画了一片绿叶，挂在树上。",
                "py": "Yí wèi lǎo huàjiā zhīdào le nǚháir de xīnsi, juédìng bāngzhù tā, jiù huàle yí piàn lǜyè, guà zài shù shang.",
                "kr": "한 노화가가 소녀의 마음을 알고 그녀를 돕기로 결심하여 초록 나뭇잎 하나를 그려 나무에 걸어 두었다."
            },
            {
                "zh": "冬天到了，这片绿叶一直留在树上。",
                "py": "Dōngtiān dào le, zhè piàn lǜyè yìzhí liú zài shù shang.",
                "kr": "겨울이 왔지만 이 초록 나뭇잎은 줄곧 나무 위에 남아 있었다."
            },
            {
                "zh": "因为这片绿叶，女孩儿奇迹般地活了下来。",
                "py": "Yīnwèi zhè piàn lǜyè, nǚháir qíjìbān de huóle xiàlai.",
                "kr": "이 초록 나뭇잎 덕분에 소녀는 기적처럼 살아남았다."
            }
        ]
    },
    {
        "id": 4,
        "title": "제4과 《影子》",
        "short_title": "4과 影子",
        "sentences": [
            {
                "zh": "李大朋是一位中学体育老师，他的身材又高又大。",
                "py": "Lǐ Dàpéng shì yí wèi zhōngxué tǐyù lǎoshī, tā de shēncái yòu gāo yòu dà.",
                "kr": "이대붕은 중학교 체육 교사였는데, 체격이 아주 크고 건장했다."
            },
            {
                "zh": "一个夏天的中午，天气非常热。",
                "py": "Yí ge xiàtiān de zhōngwǔ, tiānqì fēicháng rè.",
                "kr": "어느 여름날 정오, 날씨가 몹시 무더웠다."
            },
            {
                "zh": "李大朋下课以后，觉得又渴又累，就去超市买矿泉水。",
                "py": "Lǐ Dàpéng xiàkè yǐhòu, juéde yòu kě yòu lèi, jiù qù chāoshì mǎi kuàngquánshuǐ.",
                "kr": "이대붕은 수업을 마친 뒤 목도 마르고 피곤해서 생수를 사러 슈퍼마켓에 갔다."
            },
            {
                "zh": "李大朋走在半路上，突然发现一个小男孩儿一直跟着他。",
                "py": "Lǐ Dàpéng zǒu zài bànlù shang, tūrán fāxiàn yí ge xiǎo nánháir yìzhí gēnzhe tā.",
                "kr": "길을 걷던 이대붕은 문득 한 꼬마 사내아이가 줄곧 자신을 따라오고 있음을 발견했다."
            },
            {
                "zh": "他感到很奇怪，问：“小朋友，你怎么老跟着我呀？”",
                "py": "Tā gǎndào hěn qíguài, wèn: “Xiǎopéngyou, nǐ zěnme lǎo gēnzhe wǒ ya?”",
                "kr": "그는 이상하게 여겨 물었다: “얘야, 너 왜 자꾸 날 따라오니?”"
            },
            {
                "zh": "小男孩儿说：“太热了，我觉得在你的影子下面凉快。”",
                "py": "Xiǎo nánháir shuō: “Tài rè le, wǒ juéde zài nǐ de yǐngzi xiàmiàn liángkuai.”",
                "kr": "꼬마가 말했다: “너무 더워서 아저씨 그림자 밑에 있으면 시원해서 그래요.”"
            }
        ]
    },
    {
        "id": 5,
        "title": "제5과 《画像》",
        "short_title": "5과 画像",
        "sentences": [
            {
                "zh": "有一位著名的科学家，他从来不让人为自己画像。",
                "py": "Yǒu yí wèi zhùmíng de kēxuéjiā, tā cónglái bù ràng rén wèi zìjǐ huàxiàng.",
                "kr": "유명한 과학자 한 분이 계셨는데, 그는 다른 사람이 자신을 위해 초상화 그리는 것을 평소 결코 허락하지 않았다."
            },
            {
                "zh": "一天，一个年轻的画家来拜访他，诚恳地希望能为他画一幅肖像。",
                "py": "Yì tiān, yí ge niánqīng de huàjiā lái bàifǎng tā, chéngkěn de xīwàng néng wèi tā huà yì fú xiàoxiàng.",
                "kr": "어느 날, 한 젊은 화가가 그를 찾아와 간곡하게 그를 위해 초상화 한 폭을 그릴 수 있기를 희망했다."
            },
            {
                "zh": "科学家照例拒绝了。他说，“我从来不让人为我画像，你请回吧。”",
                "py": "Kēxuéjiā zhàolì jùjué le. Tā shuō, “Wǒ cónglái bù ràng rén wèi wǒ huàxiàng, nǐ qǐng huí ba.”",
                "kr": "과학자는 여느 때처럼 거절했다. 그는 '나는 평소 남이 날 위해 초상화 그리게 하지 않으니, 그만 돌아가시오'라고 말했다."
            },
            {
                "zh": "年轻的画家伤心地说，“先生，我母亲病得很重，需要很多钱看病。如果能为您画一幅画，卖掉它就能救我母亲的命。”",
                "py": "Niánqīng de huàjiā shāngxīn de shuō, “Xiānsheng, wǒ mǔqīn bìng de hěn zhòng, xūyào hěn duō qián kànbìng. Rúguǒ néng wèi nín huà yì fú huà, màidiào tā jiù néng jiù wǒ mǔqīn de mìng.”",
                "kr": "젊은 화가는 슬퍼하며 말했다: '선생님, 저희 어머니께서 위독하셔서 치료비가 절실합니다. 선생님 초상화를 그려 팔 수 있다면 어머니 목숨을 구할 수 있습니다.'"
            },
            {
                "zh": "科学家听了，立刻改变了态度，微笑着说，“啊，如果是为了救母亲，那就是另外一回事了！请坐下吧，我现在就让你画。”",
                "py": "Kēxuéjiā tīng le, lìkè gǎibiàn le tàidù, wēixiào zhe shuō, “À, rúguǒ shì wèile jiù mǔqīn, nà jiù shì lìngwài yì huí shì le! Qǐng zuòxià ba, wǒ xiànzài jiù ràng nǐ huà.”",
                "kr": "과학자는 그 말을 듣고 즉시 태도를 바꾸어 미소를 지으며 말했다: '아, 어머니를 구하기 위해서라면 그건 완전히 별개의 일이지요! 앉으시오, 지금 당장 그리게 해 주겠소.'"
            }
        ]
    },
    {
        "id": 6,
        "title": "제6과 《想哭就哭吧》",
        "short_title": "6과 想哭就哭吧",
        "sentences": [
            {
                "zh": "很多人都觉得，女人比男人爱哭。",
                "py": "Hěn duō rén dōu juéde, nǚrén bǐ nánrén ài kū.",
                "kr": "많은 사람들이 여자가 남자보다 잘 운다고 생각한다."
            },
            {
                "zh": "研究发现，女人的寿命确实比男人长，其中一个原因就是她们爱哭。",
                "py": "Yánjiū fāxiàn, nǚrén de shòumìng quèshí bǐ nánrén cháng, qízhōng yí ge yuányīn jiù shì tāmen ài kū.",
                "kr": "연구에 따르면 여성의 수명이 실제로 남성보다 긴데, 그 이유 중 하나가 바로 잘 울기 때문이라는 것이다."
            },
            {
                "zh": "流眼泪能帮助人体排出有害物质。",
                "py": "Liú yǎnlèi néng bāngzhù réntǐ páichū yǒuhài wùzhì.",
                "kr": "눈물을 흘리는 것은 인체에서 유해 물질을 배출하도록 도와준다."
            },
            {
                "zh": "如果不把眼泪流出来，反而对身体不好。",
                "py": "Rúguǒ bù bǎ yǎnlèi liúchūlai, fǎn'ér duì shēntǐ bù hǎo.",
                "kr": "만약 눈물을 밖으로 흘려보내지 않으면 도리어 건강에 해롭다."
            },
            {
                "zh": "所以，难过的时候，想哭就哭吧！",
                "py": "Suǒyǐ, nánguò de shíhou, xiǎng kū jiù kū ba!",
                "kr": "그러니 슬플 때는 울고 싶으면 마음껏 우세요!"
            }
        ]
    },
    {
        "id": 7,
        "title": "제7과 《照片是我照的》",
        "short_title": "7과 照片是我照的",
        "sentences": [
            {
                "zh": "今天，小张去一家商店买东西，回到家才发现把照相机落在那儿了。",
                "py": "Jīntiān, Xiǎo Zhāng qù yì jiā shāngdiàn mǎi dōngxi, huí dào jiā cái fāxiàn bǎ zhàoxiàngjī là zài nàr le.",
                "kr": "오늘 샤오장은 한 가게에 물건을 사러 갔다가, 집에 돌아와서야 카메라를 그곳에 두고 온 것을 알았다."
            },
            {
                "zh": "于是就赶紧给商店打电话。店主说，有人捡到了照相机，让他赶快去取。",
                "py": "Yúshì jiù gǎnjǐn gěi shāngdiàn dǎ diànhuà. Diànzhǔ shuō, yǒurén jiǎndào le zhàoxiàngjī, ràng tā gǎnkuài qù qǔ.",
                "kr": "이에 서둘러 가게로 전화를 걸자, 주인이 누군가 카메라를 주웠으니 어서 와서 찾아가라고 했다."
            },
            {
                "zh": "小张取回照相机，发现照相机里多了两张照片。",
                "py": "Xiǎo Zhāng qǔhuí zhàoxiàngjī, fāxiàn zhàoxiàngjī lǐ duōle liǎng zhāng zhàopiàn.",
                "kr": "샤오장은 카메라를 되찾은 뒤 안에 사진 두 장이 더 찍혀 있는 것을 발견했다."
            },
            {
                "zh": "一张照片是个女孩儿，手里举着一个牌子，上面写着：“照相机是我捡到的！”",
                "py": "Yì zhāng zhàopiàn shì ge nǚháir, shǒu lǐ jǔzhe yí ge páizi, shàngmian xiězhe: “Zhàoxiàngjī shì wǒ jiǎndào de!”",
                "kr": "한 장은 한 소녀가 푯말을 들고 있는 사진이었는데, 거기엔 “카메라는 제가 주웠어요!”라고 적혀 있었다."
            },
            {
                "zh": "另一张照片是个小伙子，手里也举着一个牌子，上面写着：“照片是我照的！”",
                "py": "Lìng yì zhāng zhàopiàn shì ge xiǎohuǒzi, shǒu lǐ yě jǔzhe yí ge páizi, shàngmian xiězhe: “Zhàopiàn shì wǒ zhào de!”",
                "kr": "다른 한 장은 한 젊은이가 역시 푯말을 들고 있는 사진이었는데, 거기엔 “사진은 제가 찍었어요!”라고 적혀 있었다."
            }
        ]
    },
    {
        "id": 8,
        "title": "제8과 《采访》",
        "short_title": "8과 采访",
        "sentences": [
            {
                "zh": "钱锺书是中国著名的作家。他的小说《围城》非常有名。",
                "py": "Qián Zhōngshū shì Zhōngguó zhùmíng de zuòjiā. Tā de xiǎoshuō 《Wéichéng》 fēicháng yǒumíng.",
                "kr": "치엔중수는 중국의 저명한 작가이다. 그의 소설 《위성(포위된 성)》은 아주 유명하다."
            },
            {
                "zh": "写的是几个年轻人的工作、生活和婚姻的故事，电视台把它改编成了电视剧。",
                "py": "Xiě de shì jǐ ge niánqīngrén de gōngzuò, shēnghuó hé hūnyīn de gùshi, diànshìtái bǎ tā gǎibiānchéngle diànshìjù.",
                "kr": "젊은이 몇 명의 일과 삶, 결혼 이야기를 다룬 것으로, 방송국에서 이를 드라마로 각색했다."
            },
            {
                "zh": "电视剧播出后，非常受欢迎。很多记者都想采访他，但是都被他拒绝了。",
                "py": "Diànshìjù bōchū hòu, fēicháng shòu huānyíng. Hěn duō jìzhě dōu xiǎng cǎifǎng tā, dànshì dōu bèi tā jùjué le.",
                "kr": "드라마가 방영된 뒤 큰 인기를 얻자 많은 기자들이 그를 인터뷰하려 했으나 모두 거절당했다."
            },
            {
                "zh": "一位记者问他为什么拒绝采访，他说：“你吃了一个好吃的鸡蛋，一定要认识那只下蛋的母鸡吗？”",
                "py": "Yí wèi jìzhě wèn tā wèishénme jùjué cǎifǎng, tā shuō: “Nǐ chīle yí ge hǎochī de jīdàn, yídìng yào rènshi nà zhī xiàdàn de mǔjī ma?”",
                "kr": "한 기자가 왜 인터뷰를 거절하느냐고 묻자, 그는 말했다: “맛있는 달걀 하나를 먹었다고 해서 꼭 그 알을 낳은 암탉까지 알아야 합니까?”"
            }
        ]
    },
    {
        "id": 9,
        "title": "제9과 《袁隆平》",
        "short_title": "9과 袁隆平",
        "sentences": [
            {
                "zh": "袁隆平是中国著名的水稻专家，被称为“杂交水稻之父”。",
                "py": "Yuán Lóngpíng shì Zhōngguó zhùmíng de shuǐdào zhuānjiā, bèi chēng wéi “Zájiāo Shuǐdào zhī Fù”.",
                "kr": "위안룽핑은 중국의 저명한 벼 연구 전문가로, '교잡 수도(하이브리드 벼)의 아버지'라 불린다."
            },
            {
                "zh": "世界上有很多人吃不饱肚子。为了解决这个问题，袁隆平一生都在研究怎样提高水稻的产量。",
                "py": "Shìjiè shang yǒu hěn duō rén chībùbǎo dùzi. Wèile jiějué zhè ge wèntí, Yuán Lóngpíng yìshēng dōu zài yánjiū zěnyàng tígāo shuǐdào de chǎnliàng.",
                "kr": "세계에는 배를 채우지 못하는 사람이 많다. 이 문제를 해결하기 위해 위안룽핑은 평생 벼 생산량을 늘리는 방법을 연구했다."
            },
            {
                "zh": "经过多年的努力，他终于培育出了高产的杂交水稻。",
                "py": "Jīngguò duō nián de nǔlì, tā zhōngyú péiyùchūle gāochǎn de zájiāo shuǐdào.",
                "kr": "수년간의 노력 끝에 그는 마침내 수확량이 높은 교잡 벼를 육종해 내었다."
            },
            {
                "zh": "这种水稻不仅在中国广泛种植，还推广到了几十个国家，养活了数以亿计的人口。",
                "py": "Zhèzhǒng shuǐdào bùjǐn zài Zhōngguó guǎngfàn zhòngzhí, hái tuīguǎngdàole jǐshí ge guójiā, yǎnghuóle shùyǐyìjì de rénkǒu.",
                "kr": "이 벼는 중국 전역에 널리 심어졌을 뿐 아니라 수십 개 국가로 보급되어 수억 명의 인구를 먹여 살렸다."
            }
        ]
    },
    {
        "id": 10,
        "title": "제10과 《幸福像自助餐》",
        "short_title": "10과 幸福像自助餐",
        "sentences": [
            {
                "zh": "幸福就像自助餐。",
                "py": "Xìngfú jiù xiàng zìzhùcān.",
                "kr": "행복은 뷔페와 같다."
            },
            {
                "zh": "如果很多人一起去吃自助餐，每个人都会根据自己的爱好选东西，并根据自己的饭量放在各自的盘子里。",
                "py": "Rúguǒ hěn duō rén yìqǐ qù chī zìzhùcān, měi ge rén dōu huì gēnjù zìjǐ de àihào xuǎn dōngxi, bìng gēnjù zìjǐ de fànliàng fàng zài gèzì de pánzi lǐ.",
                "kr": "많은 사람이 함께 뷔페에 가면 저마다 자신의 취향에 따라 음식을 고르고, 먹는 양에 맞추어 각자의 접시에 담는다."
            },
            {
                "zh": "每个人盘子里的菜都是不一样的。",
                "py": "Měi ge rén pánzi lǐ de cài dōu shì bù yíyàng de.",
                "kr": "사람마다 접시에 담긴 요리는 모두 다르다."
            },
            {
                "zh": "幸福也是这样，每个人对幸福的理解不同，需求也不同。",
                "py": "Xìngfú yě shì zhèyàng, měi ge rén duì xìngfú de lǐjiě bù tóng, xūqiú yě bù tóng.",
                "kr": "행복도 이와 같아서, 사람마다 행복에 대한 이해가 다르고 필요한 것도 다르다."
            },
            {
                "zh": "有的人在自己的盘子里装满了钱，有的人装满了情感，有的人装满了成功的事业。你的盘子里装的是什么呢？",
                "py": "Yǒu de rén zài zìjǐ de pánzi lǐ zhuāngmǎnle qián, yǒu de rén zhuāngmǎnle qínggǎn, yǒu de rén zhuāngmǎnle chénggōng de shìyè. Nǐ de pánzi lǐ zhuāng de shì shénme ne?",
                "kr": "어떤 사람은 자신의 접시에 돈을 가득 채우고, 어떤 사람은 감정을, 어떤 사람은 성공한 사업을 가득 채운다. 당신의 접시에는 무엇이 담겨 있나요?"
            }
        ]
    },
    {
        "id": 11,
        "title": "제11과 《水星》",
        "short_title": "11과 水星",
        "sentences": [
            {
                "zh": "水星是太阳系八大行星之一。",
                "py": "Shuǐxīng shì Tàiyángxì bā dà xíngxīng zhī yī.",
                "kr": "수성은 태양계 8대 행성 중 하나이다."
            },
            {
                "zh": "水星非常小，跟地球相比，它只能算是个“小兄弟”。",
                "py": "Shuǐxīng fēicháng xiǎo, gēn Dìqiú xiāngbǐ, tā zhǐ néng suànshì ge “xiǎo xiōngdì”.",
                "kr": "수성은 아주 작아서 지구와 비교하면 그저 '어린 아우'라 부를 수 있을 뿐이다."
            },
            {
                "zh": "水星离太阳最近，表面温差很大，太阳照到的地方温度高达摄氏430度，照不到的地方却只有摄氏零下170度。",
                "py": "Shuǐxīng lí tàiyáng zuì jìn, biǎomiàn wēnchā hěn dà, tàiyáng zhàodào de dìfang wēndù gāodá shèshì 430 dù, zhàobúdào de dìfang què zhǐyǒu shèshì língxià 170 dù.",
                "kr": "수성은 태양과 가장 가까워 표면 온도 차가 매우 크다. 햇빛이 비치는 곳은 섭씨 430도에 달하지만, 비치지 않는 곳은 영하 170도에 불과하다."
            },
            {
                "zh": "水星表面有很多山，它们都是用世界著名的文学家、艺术家的名字命名的，其中有15个是用中国人的名字命名的。",
                "py": "Shuǐxīng biǎomiàn yǒu hěn duō shān, tāmen dōu shì yòng shìjiè zhùmíng de wénxuéjiā, yìshùjiā de míngzi mìngmíng de, qízhōng yǒu 15 ge shì yòng Zhōngguórén de míngzi mìngmíng de.",
                "kr": "수성 표면에는 산이 많은데, 모두 세계적으로 유명한 문학가나 예술가의 이름으로 명명되었으며 그중 15개는 중국인의 이름으로 붙여졌다."
            }
        ]
    },
    {
        "id": 12,
        "title": "제12과 《送蜡烛》",
        "short_title": "12과 送蜡烛",
        "sentences": [
            {
                "zh": "一个刚搬到新公寓的年轻人，晚上遇到了停电。",
                "py": "Yí ge gāng bān dào xīn gōngyù de niánqīngrén, wǎnshang yùdàole tíngdiàn.",
                "kr": "새 아파트로 막 이사 온 한 젊은이가 저녁에 정전을 겪었다."
            },
            {
                "zh": "正当他摸索着找蜡烛时，门铃响了。开门一看，原来是隔壁的小男孩儿。",
                "py": "Zhèngdāng tā mōsuǒzhe zhǎo làzhú shí, ménlíng xiǎng le. Kāi mén yí kàn, yuánlái shì gébì de xiǎo nánháir.",
                "kr": "그가 더듬거리며 양초를 찾고 있을 때 초인종이 울렸다. 문을 열어보니 옆집의 어린 사내아이였다."
            },
            {
                "zh": "小男孩儿问：“叔叔，您家里有蜡烛吗？”",
                "py": "Xiǎo nánháir wèn: “Shūshu, nín jiā lǐ yǒu làzhú ma?”",
                "kr": "아이가 물었다: “아저씨, 댁에 양초 있으세요?”"
            },
            {
                "zh": "年轻人心想：刚搬来就来借东西，真麻烦！于是冷冷地说：“没有！”",
                "py": "Niánqīngrén xīnxiǎng: Gāng bānlái jiù lái jiè dōngxi, zhēn máfan! Yúshì lěnglěng de shuō: “Méiyǒu!”",
                "kr": "젊은이는 속으로 '이사 오자마자 물건 빌리러 오다니 번거롭네!'라고 생각하며 쌀쌀맞게 “없단다!”라고 말했다."
            },
            {
                "zh": "没想到小男孩儿笑了，从怀里拿出两根蜡烛说：“我就知道您刚搬来一定没有，妈妈让我给您送两根来！”",
                "py": "Méi xiǎngdào xiǎo nánháir xiào le, cóng huái lǐ náchū liǎng gēn làzhú shuō: “Wǒ jiù zhīdào nín gāng bānlái yídìng méiyǒu, māma ràng wǒ gěi nín sòng liǎng gēn lái!”",
                "kr": "뜻밖에도 아이는 웃으며 품에서 양초 두 자루를 꺼내어 말했다: “이사 오신 지 얼마 안 돼서 분명 없으실 줄 알았어요. 엄마가 두 자루 갖다 드리라고 하셨어요!”"
            }
        ]
    },
    {
        "id": 13,
        "title": "제13과 《卖扇子》",
        "short_title": "13과 卖扇子",
        "sentences": [
            {
                "zh": "有一天，一位老奶奶在集市上卖扇子，过了好长时间也没有人买，她十分着急。",
                "py": "Yǒu yì tiān, yí wèi lǎonǎinai zài jíshì shang mài shànzi, guòle hǎo cháng shíjiān yě méiyǒu rén mǎi, tā shífēn zhāojí.",
                "kr": "어느 날 한 할머니가 장터에서 부채를 팔고 있었는데, 한참이 지나도 사는 사람이 없어 무척 애가 탔다."
            },
            {
                "zh": "这时候走过来一个人，拿起扇子就在上面写起字来。老奶奶很不高兴，不让他写。",
                "py": "Zhè shíhou zǒuguòlai yí ge rén, náqǐ shànzi jiù zài shàngmian xiěqǐ zì lái. Lǎonǎinai hěn bù gāoxìng, bù ràng tā xiě.",
                "kr": "이때 한 사람이 다가오더니 부채를 집어 들고 그 위에 글씨를 쓰기 시작했다. 할머니는 언짢아서 쓰지 못하게 했다."
            },
            {
                "zh": "这个人却极其自信地说：“您放心，写了字保证就有人买了。”写完他就走了。",
                "py": "Zhè ge rén què jíqí zìxìn de shuō: “Nín fàngxīn, xiěle zì bǎozhèng jiù yǒurén mǎi le.” Xiěwán tā jiù zǒu le.",
                "kr": "하지만 그 사람은 매우 자신만만하게 말했다: “안심하세요, 글씨를 써두면 분명 사는 사람이 있을 겁니다.” 글씨를 다 쓴 뒤 그는 떠났다."
            },
            {
                "zh": "果然，他刚走，人们立刻围了上来，抢着买，扇子很快就卖光了。",
                "py": "Guǒrán, tā gāng zǒu, rénmen lìkè wéile shànglai, qiǎngzhe mǎi, shànzi hěn kuài jiù màiguāng le.",
                "kr": "과연 그가 떠나자마자 사람들이 곧장 몰려들어 앞다투어 샀고, 부채는 순식간에 동이 났다."
            },
            {
                "zh": "原来，写字的人是王羲之，他是中国古代最有名的书法家之一。",
                "py": "Yuánlái, xiězì de rén shì Wáng Xīzhī, tā shì Zhōngguó gǔdài zuì yǒumíng de shūfǎjiā zhī yī.",
                "kr": "알고 보니 글씨를 쓴 사람은 왕희지였으며, 그는 중국 고대 역사상 가장 유명한 서예가 중 한 명이었다."
            }
        ]
    },
    {
        "id": 14,
        "title": "제14과 《找声音》",
        "short_title": "14과 找声音",
        "sentences": [
            {
                "zh": "来中国之后，我每天都学唱中国歌。",
                "py": "Lái Zhōngguó zhīhòu, wǒ měitiān dōu xué chàng Zhōngguó gē.",
                "kr": "중국에 온 뒤로 나는 매일 중국 노래 부르는 법을 배웠다."
            },
            {
                "zh": "老师说，要想唱好歌，必须找到自己的声音。",
                "py": "Lǎoshī shuō, yào xiǎng chànghǎo gē, bìxū zhǎodào zìjǐ de shēngyīn.",
                "kr": "선생님은 노래를 잘 부르려면 반드시 자신만의 소리를 찾아야 한다고 말씀하셨다."
            },
            {
                "zh": "起初我不明白这是什么意思，只是努力模仿别人的发音。",
                "py": "Qǐchū wǒ bù míngbai zhè shì shénme yìsi, zhǐshì nǔlì mófǎng biérén de fāyīn.",
                "kr": "처음에는 이 말이 무슨 뜻인지 몰라 그저 다른 사람의 발성을 열심히 흉내 낼 뿐이었다."
            },
            {
                "zh": "后来我才懂得，只有用真情实感去唱，发自内心的声音才是最打动人的。",
                "py": "Hòulái wǒ cái dǒngde, zhǐyǒu yòng zhēnqíng-shígǎn qù chàng, fāzì nèixīn de shēngyīn cái shì zuì dǎdòng rén de.",
                "kr": "나중에야 비로소 진심 어린 감정으로 노래해야만 마음 깊은 곳에서 우러나오는 가장 감동적인 소리가 된다는 것을 깨달았다."
            }
        ]
    },
    {
        "id": 15,
        "title": "제15과 《一封被退回来的信》",
        "short_title": "15과 一封被退回来的信",
        "sentences": [
            {
                "zh": "一个刚学汉语的外国留学生，写了一封信给朋友。",
                "py": "Yí ge gāng xué Hànyǔ de wàiguó liúxuéshēng, xiěle yì fēng xìn gěi péngyou.",
                "kr": "중국어를 막 배우기 시작한 한 외국인 유학생이 친구에게 편지 한 통을 썼다."
            },
            {
                "zh": "过了几天，这封信竟然被邮局退了回来。",
                "py": "Guòle jǐ tiān, zhè fēng xìn jìngrán bèi yóujú tuìle huílai.",
                "kr": "며칠 후, 뜻밖에도 이 편지가 우체국에서 반송되어 돌아왔다."
            },
            {
                "zh": "信封上写着几个大字：“查无此人”。",
                "py": "Xìnfēng shang xiězhe jǐ ge dà zì: “Chá wú cǐ rén”.",
                "kr": "봉투 위에는 '해당 인물 없음'이라는 큰 글씨가 적혀 있었다."
            },
            {
                "zh": "他仔细一看，才发现信封上贴邮票的地方，竟然写成了收信人的地址，而收信人的地址写成了寄信人的地址。",
                "py": "Tā zǐxì yí kàn, cái fāxiàn xìnfēng shang tiē yóupiào de dìfang, jìngrán xiěchéngle shōuxìnrén de dìzhǐ, ér shōuxìnrén de dìzhǐ xiěchéngle jìxìnrén de dìzhǐ.",
                "kr": "그가 자세히 살펴보니 우표를 붙이는 자리에 수취인 주소를 쓰고, 수취인 주소 자리에는 발신인 주소를 잘못 적은 것이었다."
            }
        ]
    },
    {
        "id": 16,
        "title": "제16과 《汽车的颜色和安全》",
        "short_title": "16과 汽车的颜色和安全",
        "sentences": [
            {
                "zh": "研究发现，汽车的颜色和安全的关系很大。",
                "py": "Yánjiū fāxiàn, qìchē de yánsè hé ānquán de guānxi hěn dà.",
                "kr": "연구에 따르면 차량의 색상과 안전은 아주 밀접한 관계가 있다."
            },
            {
                "zh": "白色和银色最安全，红色、蓝色和绿色比较安全，黑色最不安全。",
                "py": "Báisè hé yínsè zuì ānquán, hóngsè, lánsè hé lǜsè bǐjiào ānquán, hēisè zuì bù ānquán.",
                "kr": "흰색과 은색이 가장 안전하고, 빨간색, 파란색, 초록색이 비교적 안전하며, 검은색이 가장 안전하지 않다."
            },
            {
                "zh": "这是因为，浅颜色让人觉得车更宽、更大，比深颜色更能引起人们的注意。",
                "py": "Zhè shì yīnwèi, qiǎnyánsè ràng rén juéde chē gèng kuān, gèng dà, bǐ shēnyánsè gèng néng yǐnqǐ rénmen de zhùyì.",
                "kr": "밝은 색상은 차를 더 넓고 커 보이게 하여 어두운 색상보다 사람들의 주의를 더 잘 끌기 때문이다."
            },
            {
                "zh": "当然，行车安全，最重要的不是汽车的颜色，而是良好的开车习惯。",
                "py": "Dāngrán, xíngchē ānquán, zuì zhòngyào de bú shì qìchē de yánsè, érshì liánghǎo de kāichē xíguàn.",
                "kr": "물론 운전 안전에 있어 가장 중요한 것은 차량 색상이 아니라 올바른 운전 습관이다."
            }
        ]
    },
    {
        "id": 17,
        "title": "제17과 《明天别来了》",
        "short_title": "17과 明天别来了",
        "sentences": [
            {
                "zh": "有一天，张老板到工厂检查工作，看见一个年轻人懒洋洋地靠在箱子上。",
                "py": "Yǒu yì tiān, Zhāng lǎobǎn dào gōngchǎng jiǎnchá gōngzuò, kànjiàn yí ge niánqīngrén lǎnyāngyāng de kào zài xiāngzi shang.",
                "kr": "어느 날 장 사장이 공장에 시찰을 나갔다가 한 젊은이가 상자에 나태하게 기대어 있는 것을 보았다."
            },
            {
                "zh": "张老板不满地问：“你一周挣多少钱？”“五百元。”年轻人奇怪地看着他。",
                "py": "Zhāng lǎobǎn bùmǎn de wèn: “Nǐ yì zhōu zhèng duōshao qián?” “Wǔbǎi yuán.” Niánqīngrén qíguài de kànzhe tā.",
                "kr": "장 사장은 불만스럽게 물었다: “자네 한 주에 얼마 버나?” “오백 위안요.” 젊은이는 의아하게 그를 바라보았다."
            },
            {
                "zh": "张老板拿出五百元钱，严肃地说：“这是你一周的工资，明天你别来了。”年轻人收下钱就走了。",
                "py": "Zhāng lǎobǎn náchū wǔbǎi yuán qián, yánsù de shuō: “Zhè shì nǐ yì zhōu de gōngzī, míngtiān nǐ bié lái le.” Niánqīngrén shōuxià qián jiù zǒu le.",
                "kr": "장 사장은 오백 위안을 꺼내어 엄숙하게 말했다: “이게 자네 한 주 치 급여일세, 내일부터 나오지 말게.” 젊은이는 돈을 받고 떠났다."
            },
            {
                "zh": "“他在咱们厂工作多长时间了？”张老板问旁边的工人。“他不是咱们厂的，”工人小心翼翼地说，“他是来送快递的。”",
                "py": "“Tā zài zánmen chǎng gōngzuò duō cháng shíjiān le?” Zhāng lǎobǎn wèn pángbiān de gōngrén. “Tā bú shì zánmen chǎng de,” gōngrén xiǎoxīnyìyì de shuō, “tā shì lái sòng kuàidì de.”",
                "kr": "“저 친구 우리 공장에서 일한 지 얼마나 되었나?” 장 사장이 옆의 직원에게 묻자, 직원이 조심스레 말했다: “우리 공장 직원이 아닙니다. 택배 배달하러 온 사람인데요.”"
            }
        ]
    },
    {
        "id": 18,
        "title": "제18과 《狗不理》",
        "short_title": "18과 狗不理",
        "sentences": [
            {
                "zh": "天津的“狗不理”包子店已经有一百多年的历史了。",
                "py": "Tiānjīn de “Gǒubùlǐ” bāozidiàn yǐjīng yǒu yìbǎi duō nián de lìshǐ le.",
                "kr": "텐진의 '거우부리' 만두가게는 이미 100여 년의 역사를 지니고 있다."
            },
            {
                "zh": "传说店主叫高贵友，小名叫“狗子”。狗子做的包子又好吃又好看，还很便宜。",
                "py": "Chuánshuō diànzhǔ jiào Gāo Guìyǒu, xiǎomíng jiào “Gǒuzi”. Gǒuzi zuò de bāozi yòu hǎochī yòu hǎokàn, hái hěn piányi.",
                "kr": "전해지는 바로는 주인 이름이 고귀우였고 어릴 적 별명이 '거우쯔'였다. 거우쯔가 만든 만두는 맛도 좋고 모양도 예쁜 데다 값도 저렴했다."
            },
            {
                "zh": "店里的顾客太多了，他忙极了，只好让顾客把钱放在桌子上，他根据钱数给包子。",
                "py": "Diàn lǐ de gùkè tài duō le, tā máng jí le, zhǐhǎo ràng gùkè bǎ qián fàng zài zhuōzi shang, tā gēnjù qiánshù gěi bāozi.",
                "kr": "손님이 너무 많아 그는 눈코 뜰 새 없이 바빴기에, 손님더러 식탁에 돈을 놓게 하고 돈의 액수에 맞추어 만두를 내줄 수밖에 없었다."
            },
            {
                "zh": "因为太忙，他没有时间跟顾客说话，人们就开玩笑说：“狗子卖包子，谁都不理。”后来，他家的包子就被叫作“狗不理”了。",
                "py": "Yīnwèi tài máng, tā méiyǒu shíjiān gēn gùkè shuōhuà, rénmen jiù kāi wánxiào shuō: “Gǒuzi mài bāozi, shéi dōu bù lǐ.” Hòulái, tā jiā de bāozi jiù bèi jiàozuò “Gǒubùlǐ” le.",
                "kr": "너무 바빠 손님과 말을 나눌 틈도 없자 사람들은 “거우쯔가 만두 파느라 누구 말도 안 섞네”라고 농담을 건넸다. 이후 그의 만두는 '거우부리(개를 거들떠보지 않는다)'로 불리게 되었다."
            }
        ]
    },
    {
        "id": 19,
        "title": "제19과 《不敢说》",
        "short_title": "19과 不敢说",
        "sentences": [
            {
                "zh": "小李嗓子疼，到医院看病。大夫认真检查后说：“扁桃体发炎了，最好切除。”他听了大夫的建议，做了手术，把扁桃体切掉了。",
                "py": "Xiǎo Lǐ sǎngzi téng, dào yīyuàn kànbìng. Dàifu rènzhēn jiǎnchá hòu shuō: “Biǎntáotǐ fāyán le, zuìhǎo qiēchú.” Tā tīngle dàifu de jiànyì, zuòle shǒushù, bǎ biǎntáotǐ qiēdiào le.",
                "kr": "샤오리는 목이 아파 병원에 진찰을 받으러 갔다. 의사는 꼼꼼히 살피더니 “편도염이 생겼으니 절제하는 것이 좋겠습니다”라고 했다. 그는 의사의 권유에 따라 수술하여 편도를 떼어냈다."
            },
            {
                "zh": "过了半年，小李肚子疼得受不了，又去找大夫。大夫说：“盲肠发炎了，必须切除！”他听了大夫的建议，把盲肠也切掉了。",
                "py": "Guòle bàn nián, Xiǎo Lǐ dùzi téng de shòubuliǎo, yòu qù zhǎo dàifu. Dàifu shuō: “Mángcháng fāyán le, bìxū qiēchú!” Tā tīngle dàifu de jiànyì, bǎ mángcháng yě qiēdiào le.",
                "kr": "반년 후 샤오리는 배가 견딜 수 없이 아파 다시 의사를 찾았다. 의사는 “맹장염이니 반드시 잘라내야 합니다!”라고 했고, 그는 맹장마저 절제했다."
            },
            {
                "zh": "又过了半年，小李又去找大夫。大夫问：“你又怎么了？”他小声说：“我不敢跟您说。”",
                "py": "Yòu guòle bàn nián, Xiǎo Lǐ yòu qù zhǎo dàifu. Dàifu wèn: “Nǐ yòu zěnme le?” Tā xiǎoshēng shuō: “Wǒ bù gǎn gēn nín shuō.”",
                "kr": "다시 반년이 지나 샤오리가 또 의사를 찾아오자 의사가 물었다: “이번엔 또 어디가 아픈가요?” 그는 작은 목소리로 말했다: “선생님께 말씀드리기가 겁납니다.”"
            },
            {
                "zh": "“你到底怎么了？”“我……我头疼！”",
                "py": "“Nǐ dàodǐ zěnme le?” “Wǒ... wǒ tóuténg!”",
                "kr": "“도대체 어디가 아픈데요?” “저... 저 머리가 아픕니다!(머리까지 잘라낼까 봐 겁납니다)”"
            }
        ]
    },
    {
        "id": 20,
        "title": "제20과 《数字中国》",
        "short_title": "20과 数字中国",
        "sentences": [
            {
                "zh": "中国在亚洲东部，陆地面积960万平方公里。",
                "py": "Zhōngguó zài Yàzhōu dōngbù, lùdì miànjī 960 wàn píngfāng gōnglǐ.",
                "kr": "중국은 아시아 동부에 위치하며, 육지 면적은 960만 제곱킬로미터에 달한다."
            },
            {
                "zh": "长江是中国第一大河、世界第三大河，长6397公里。黄河是中国第二大河，长5464公里。",
                "py": "Cháng Jiāng shì Zhōngguó dì-yī dàhé, Shìjiè dì-sān dàhé, cháng 6397 gōnglǐ. Huáng Hé shì Zhōngguó dì-èr dàhé, cháng 5464 gōnglǐ.",
                "kr": "양쯔강은 중국 제일의 강이자 세계 세 번째 강으로 길이가 6,397km이다. 황하는 중국 두 번째 강으로 5,464km이다."
            },
            {
                "zh": "珠穆朗玛峰高8844.43米，是中国最高的山峰，也是世界最高的山峰。",
                "py": "Zhūmùlǎngmǎ Fēng gāo 8844.43 mǐ, shì Zhōngguó zuì gāo de shānfēng, yě shì Shìjiè zuì gāo de shānfēng.",
                "kr": "에베레스트산은 해발 8,844.43미터로 중국 최고봉이자 세계 최고봉이다."
            },
            {
                "zh": "中国总人口达14亿人，是多民族国家，有56个民族。汉族人口最多，占全国总人口的90%以上。",
                "py": "Zhōngguó zǒng rénkǒu dá 14 yì rén, shì duō mínzú guójiā, yǒu 56 ge mínzú. Hànzú rénkǒu zuì duō, zhàn quánguó zǒng rénkǒu de 90% yǐshàng.",
                "kr": "중국의 총인구는 14억 명에 달하며, 56개 민족으로 구성된 다민족 국가이다. 한족이 가장 많아 전국 인구의 90% 이상을 차지한다."
            }
        ]
    }
]

portrait_vocab = [
    {"zh": "画像", "py": "huàxiàng", "pos": "동사/명사", "kr": "초상화를 그리다, 초상화", "level": "🟢 필수", "note": "제5과 핵심 제재"},
    {"zh": "科学家", "py": "kēxuéjiā", "pos": "명사", "kr": "과학자", "level": "🟢 HSK 4급", "note": "이야기의 주인공"},
    {"zh": "从来", "py": "cónglái", "pos": "부사", "kr": "줄곧, 여태껏", "level": "🟡 HSK 4급", "note": "从来不 (원칙적 부정) vs 从来没 (경험적 부정)"},
    {"zh": "诚恳", "py": "chéngkěn", "pos": "형용사", "kr": "간곡하다, 진실하다", "level": "🟡 HSK 5급", "note": "화가의 태도"},
    {"zh": "改变态度", "py": "gǎibiàn tàidù", "pos": "동사구", "kr": "태도를 바꾸다", "level": "🟡 중급", "note": "모성애에 감동하여 마음을 돌림"},
    {"zh": "另外一回事", "py": "lìngwài yì huí shì", "pos": "관용구", "kr": "완전히 별개의 일", "level": "🟡 관용구", "note": "규칙의 예외를 인정하는 과학자의 온정"}
]

# ==============================================================================
# COMBINE ALL VOCABULARY FOR FLASHCARDS
# ==============================================================================
all_vocab_list = []
for p in by_paragraphs:
    for v in p['vocab']:
        all_vocab_list.append({**v, "book": "背影", "source": f"배영 {p['paragraph']}문단"})

for s in ty_scenes:
    # simple extract of notable words from each scene
    all_vocab_list.append({"zh": s['zh'][:6], "py": s['py'].split()[0] if s['py'] else "", "pos": "표현", "kr": s['title'], "level": "🟡 团圆", "book": "团圆", "source": f"단원 씬 {s['scene']}"})

for v in portrait_vocab:
    all_vocab_list.append({**v, "book": "신개념3·画像", "source": "듣기말하기 5과"})

# Weekly courses data
weekly_courses = [
    {
        "day": "월요일",
        "courses": [
            {
                "id": "mon-zh-b1-integ",
                "name": "중국어B1(통합실습)",
                "time": "5~6교시 (13:00~15:00)",
                "room": "인문관 301호",
                "prof": "정혜선 교수님",
                "midterm_book": "산문 《背影》 · 동화책 《团圆》 · 강독 《雨的四季》",
                "tasks": [
                    {"title": "《背影》 2페이지 번역 및 수업 낭독 연습 (완비)", "done": True},
                    {"title": "《团圆》 14개 씬 줄거리 & 10줄 감상문(读后感) 체화", "done": True},
                    {"title": "《雨的四季》 겨울비 11문장 & 결문 6문장 낭독 준비", "done": True},
                    {"title": "중간고사 산문 《背影》 7개 문단 3단 대역 전수 암기", "done": False}
                ]
            },
            {
                "id": "mon-zh-b1-speak",
                "name": "중국어B1(듣기·말하기)",
                "time": "3~4교시 (11:00~13:00)",
                "room": "백년관 207호",
                "prof": "Wu Juan (오연) 교수님",
                "midterm_book": "신개념 중국어 3",
                "tasks": [
                    {"title": "제5과 《画像》 본문 낭독 & 신출 단어 13종 복습 (완비)", "done": True},
                    {"title": "부사 从来不 vs 从来没 문법 공식 체화", "done": True}
                ]
            }
        ]
    },
    {
        "day": "화요일",
        "courses": [
            {
                "id": "tue-adv-comm",
                "name": "Adv Communication for Global Leaders",
                "time": "1~2교시",
                "tasks": [{"title": "Presentation Script 피드백 및 발음 낭독 연습", "done": False}]
            },
                        {
                "id": "tue-college-eng",
                "name": "College English 2 (Billy Joseph Fitzgerald)",
                "time": "5~6교시",
                "room": "0508호",
                "prof": "Billy Joseph Fitzgerald (원어민 / 성적비중 60%)",
                "midterm_book": "Pathways 3 (Reading, Writing, and Critical Thinking)",
                "tasks": [
                    {"title": "Pathways 3 Unit 1, 3, 5 Target Words 60종 Cengage 영영 정의 완벽 암기", "done": False},
                    {"title": "Reading 1 본문 3편(What Are They Thinking?, Living on an Urban Planet, The New Face of Tourism) 정독", "done": False},
                    {"title": "Cengage Test Bank 실전 모의고사 30문항 풀이 및 오답 점검", "done": False},
                    {"title": "In-Class Writing: 5문단 비교대조 에세이 Outline 및 핵심 문장 암기", "done": False}
                ]
            }
        ]
    },
    {
        "day": "수요일",
        "courses": [
                        {
                "id": "wed-college-eng",
                "name": "College English 2 (김나나 교수님)",
                "time": "4교시",
                "room": "0508호",
                "prof": "김나나 교수님 (KNN / 성적비중 30%)",
                "midterm_book": "Prism Reading 3 (Unit 5 Architecture & Unit 6 Energy)",
                "tasks": [
                    {"title": "Prism Reading 3 Unit 5 (Architecture) Reading 1 & 2 원문 및 3단 대역 정독", "done": False},
                    {"title": "Prism Reading 3 Unit 6 (Energy) Reading 1 & 2 원문 및 3단 대역 정독", "done": False},
                    {"title": "김나나 교수님 6대 출제 유형 고난도 실전 모의고사 24문항 풀이 및 오답 정리", "done": False}
                ]
            },
            {
                "id": "wed-data-struct",
                "name": "Data Structure (자료구조)",
                "time": "3~4교시",
                "tasks": [{"title": "Linked List 및 Stack 구현 알고리즘 복습", "done": False}]
            },
            {
                "id": "wed-global-biz",
                "name": "Global Business Environment",
                "time": "5~6교시",
                "tasks": [{"title": "글로벌 통상 환경 케이스 스터디 읽기", "done": False}]
            }
        ]
    },
    {
        "day": "목요일",
        "courses": [
            {
                "id": "thu-mis",
                "name": "MIS for Business Innovation",
                "time": "3~4교시",
                "tasks": [{"title": "비즈니스 정보 시스템 및 IT 혁신 사례 정리", "done": False}]
            }
        ]
    }
]

# Encrypt weekly courses with AES-256-GCM + PBKDF2
SCHEDULE_PASSWORD = b"shit!18!shit!18!"
sched_salt = os.urandom(16)
sched_iv = os.urandom(12)
sched_kdf = PBKDF2HMAC(
    algorithm=hashes.SHA256(),
    length=32,
    salt=sched_salt,
    iterations=100000,
)
sched_key = sched_kdf.derive(SCHEDULE_PASSWORD)
sched_aesgcm = AESGCM(sched_key)
sched_plaintext = json.dumps(weekly_courses, ensure_ascii=False).encode('utf-8')
sched_ciphertext = sched_aesgcm.encrypt(sched_iv, sched_plaintext, None)

encrypted_schedule = {
    "salt": base64.b64encode(sched_salt).decode('utf-8'),
    "iv": base64.b64encode(sched_iv).decode('utf-8'),
    "ciphertext": base64.b64encode(sched_ciphertext).decode('utf-8')
}

app_data = {
    "title": "HUFS 26-2 Mobile Study Web",
    "updated_at": "2026-10-12 03:30",
    "encrypted_schedule": encrypted_schedule,
    "weekly_courses": [],
    "books": {
        "beiying": {
            "id": "beiying",
            "name": "《背影 (뒷모습)》",
            "author": "주쯔칭 (朱自清)",
            "category": "통합실습 중간고사 산문",
            "sections": [
                {
                    "id": p["paragraph"],
                    "title": f"제{p['paragraph']}문단: {p['title']}",
                    "short_title": f"제{p['paragraph']}문단",
                    "sentences": p["sentences"]
                }
                for p in by_paragraphs
            ],
            "vocab": [v for p in by_paragraphs for v in p["vocab"]],
            "grammar": by_grammar,
            "qa": by_qa
        },
        "tuanyuan": {
            "id": "tuanyuan",
            "name": "《团圆 (단원)》",
            "author": "위리충 (余丽琼)",
            "category": "통합실습 중간고사 동화책",
            "sections": [
                {
                    "id": s["scene"],
                    "title": f"씬 {s['scene']}: {s['title']}",
                    "short_title": f"씬 {s['scene']}",
                    "sentences": [
                        {"zh": s["zh"], "py": s["py"], "kr": s["kr"]}
                    ]
                }
                for s in ty_scenes
            ],
            "review_10lines": ty_review,
            "qa": ty_qa
        },
        "rain": {
            "id": "rain",
            "name": "《雨的四季 (비의 사계)》",
            "author": "유잔추 (刘湛秋)",
            "category": "통합실습 강독 현대시",
            "sections": [
                {
                    "id": idx + 1,
                    "title": s["title"],
                    "short_title": s["title"].split()[0],
                    "sentences": s["sentences"]
                }
                for idx, s in enumerate(rain_sections)
            ]
        },
        "chinese3": {
            "id": "chinese3",
            "name": "《신개념 중국어 3》",
            "author": "오연 교수님",
            "category": "듣기·말하기 전20과 종합 커리큘럼",
            "sections": chinese3_sections,
            "vocab": portrait_vocab,
            "grammar": [
                {
                    "title": "부사 从来(cónglái) 2대 부정 공식",
                    "desc": "1. 从来不 + V : 평소 습관이나 원칙적 거부 ('원래 절대 안 한다')\n- 예: 他从来不让人为自己画像。\n\n2. 从来没 + V : 지금까지 과거의 경험 부재 ('여태껏 한 번도 한 적 없다')\n- 예: 我从来没去过中国。"
                },
                {
                    "title": "개사 为(wèi)의 대상·수혜 용법",
                    "desc": "구조: 为 + 대상 + 동사구 ('~를 위하여 / ~를 대상으로')\n- 예: 为他画像 (그를 위해 초상화를 그리다)\n- 예: 为了救母亲 (어머니를 구하기 위하여)"
                }
            ]
        },
                "pathways3": {
            "id": "pathways3",
            "name": "《Pathways 3》",
            "author": "Billy Joseph Fitzgerald",
            "category": "대학영어 2 (원어민 / 실질 60%)",
            "vocab": [
                {
                    "zh": v["word"],
                    "py": f"[{v['pos']} · {v['unit']}]",
                    "kr": f"{v['def_en']} ({v['kr']})",
                    "level": v["unit"],
                    "note": v["ex"]
                }
                for v in json.load(open(os.path.join(BASE_PARENT, "data", "english", "pathways3_vocab.json"), encoding="utf-8"))
            ],
            "qa": [
                {
                    "question": item["q"],
                    "answer": item["a"]
                }
                for item in json.load(open(os.path.join(BASE_PARENT, "data", "english", "billy_exam.json"), encoding="utf-8"))
            ]
        },
        "knn_exam": {
            "id": "knn_exam",
            "name": "《Prism Reading 3》",
            "author": "김나나 교수님 (KNN / 실질 30%)",
            "category": "대학영어 2 (한국인)",
            "qa": [
                {
                    "question": item["q"],
                    "answer": item["a"]
                }
                for item in json.load(open(os.path.join(BASE_PARENT, "data", "english", "knn_exam.json"), encoding="utf-8"))
            ]
        },
        "portrait": {
            "id": "portrait",
            "name": "《画像 (초상화)》",
            "author": "신개념 중국어 3",
            "category": "듣기·말하기 제5과 본문",
            "sections": [s for s in chinese3_sections if s["id"] == 5] or [
                {
                    "id": 1,
                    "title": "제5과 《画像》 과학자 초상화 본문 전편",
                    "short_title": "제5과 본문",
                    "sentences": portrait_sentences
                }
            ],
            "vocab": portrait_vocab,
            "grammar": [
                {
                    "title": "부사 从来(cónglái) 2대 부정 공식",
                    "desc": "1. 从来不 + V : 평소 습관이나 원칙적 거부 ('원래 절대 안 한다')\n- 예: 他从来不让人为自己画像。\n\n2. 从来没 + V : 지금까지 과거의 경험 부재 ('여태껏 한 번도 한 적 없다')\n- 예: 我从来没去过中国。"
                },
                {
                    "title": "개사 为(wèi)의 대상·수혜 용법",
                    "desc": "구조: 为 + 대상 + 동사구 ('~를 위하여 / ~를 대상으로')\n- 예: 为他画像 (그를 위해 초상화를 그리다)\n- 예: 为了救母亲 (어머니를 구하기 위하여)"
                }
            ]
        }
    }
}

# ==============================================================================
# 5. EXPORT MODULAR JSON FILES & BACKWARD-COMPATIBLE BUNDLE
# ==============================================================================
data_dir = os.path.join(ROOT_DIR, '00_모바일_학습웹_배포', 'data')
books_dir = os.path.join(data_dir, 'books')
dict_dir = os.path.join(data_dir, 'dict')
os.makedirs(books_dir, exist_ok=True)
os.makedirs(dict_dir, exist_ok=True)

# 1) Master dictionary JSON
with open(os.path.join(dict_dir, 'master_dict.json'), 'w', encoding='utf-8') as f:
    json.dump(master_dict, f, ensure_ascii=False, indent=2)

# 2) Index metadata JSON
with open(os.path.join(data_dir, 'index.json'), 'w', encoding='utf-8') as f:
    json.dump({
        'title': app_data['title'],
        'updated_at': app_data['updated_at'],
        'encrypted_schedule': app_data['encrypted_schedule'],
        'weekly_courses': []
    }, f, ensure_ascii=False, indent=2)

# 3) Individual book JSONs
for b_id, b_data in app_data['books'].items():
    with open(os.path.join(books_dir, f'{b_id}.json'), 'w', encoding='utf-8') as f:
        json.dump(b_data, f, ensure_ascii=False, indent=2)

# 4) Complete app_data bundle in data.js
app_data['dict'] = master_dict

ds_quiz_data = []
ds_quiz_path = os.path.join(BASE_PARENT, 'data', 'ds_quiz.json')
if os.path.exists(ds_quiz_path):
    with open(ds_quiz_path, 'r', encoding='utf-8') as f:
        ds_quiz_data = json.load(f)

with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
    f.write('var HUFS_DATA = ' + json.dumps(app_data, ensure_ascii=False, indent=2) + ';\n')
    f.write('var DS_QUIZ_DATA = ' + json.dumps(ds_quiz_data, ensure_ascii=False, indent=2) + ';\n')
    f.write('if (typeof window !== "undefined") { window.HUFS_DATA = HUFS_DATA; window.DS_QUIZ_DATA = DS_QUIZ_DATA; }\n')

print(f"Build complete! Unified books: Beiying ({len(by_paragraphs)}p), Tuanyuan ({len(ty_scenes)}s), Rain ({len(rain_sections)}s), Chinese3 ({len(chinese3_sections)} lessons, {sum(len(s['sentences']) for s in chinese3_sections)} sentences).")
print(f"Master dictionary compiled with {len(master_dict)} words into data/dict/master_dict.json and data.js.")
print(f"Data Structure quiz data compiled with {len(ds_quiz_data)} chapters ({sum(len(c['questions']) for c in ds_quiz_data)} questions) into data.js.")
