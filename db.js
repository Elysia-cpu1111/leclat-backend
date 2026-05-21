const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'ecommerce.db');
let db = null;

function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

async function initDatabase() {
  const SQL = await initSqlJs();

  // Load existing database or create new
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('已加载现有数据库');
  } else {
    db = new SQL.Database();
    console.log('已创建新数据库');
  }

  // Enable WAL-like behavior by saving frequently
  db.run('PRAGMA foreign_keys = ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      image TEXT,
      description TEXT
    )
  `);

  db.run(`CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER,
      price REAL NOT NULL,
      original_price REAL,
      description TEXT,
      image TEXT,
      images TEXT,
      specs TEXT,
      stock INTEGER DEFAULT 100,
      badge TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(category_id) REFERENCES categories(id)
    )
  `);

  db.run(`CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      size TEXT,
      quantity INTEGER DEFAULT 1,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(product_id) REFERENCES products(id)
    )
  `);

  db.run(`CREATE TABLE IF NOT EXISTS wishlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(product_id) REFERENCES products(id),
      UNIQUE(user_id, product_id)
    )
  `);

  db.run(`CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      order_no TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'pending',
      total REAL NOT NULL,
      address TEXT,
      payment_method TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  db.run(`CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT,
      product_image TEXT,
      size TEXT,
      price REAL NOT NULL,
      quantity INTEGER DEFAULT 1,
      FOREIGN KEY(order_id) REFERENCES orders(id)
    )
  `);

  db.run(`CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK(rating>=1 AND rating<=5),
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(product_id) REFERENCES products(id)
    )
  `);

  // New tables for enhanced features
  db.run(`CREATE TABLE IF NOT EXISTS addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      province TEXT,
      city TEXT,
      district TEXT,
      detail TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  db.run(`CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      type TEXT DEFAULT 'fixed',  -- fixed / percent
      value REAL NOT NULL,        -- 金额或百分比
      min_order REAL DEFAULT 0,   -- 最低消费
      max_discount REAL,          -- 百分比券最大折扣
      usage_limit INTEGER DEFAULT 100,
      used_count INTEGER DEFAULT 0,
      start_date DATETIME,
      end_date DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`CREATE TABLE IF NOT EXISTS user_coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      coupon_id INTEGER NOT NULL,
      used INTEGER DEFAULT 0,
      used_at DATETIME,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(coupon_id) REFERENCES coupons(id)
    )
  `);

  db.run(`CREATE TABLE IF NOT EXISTS banners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      image TEXT NOT NULL,
      title TEXT,
      subtitle TEXT,
      link TEXT,
      sort_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: add avatar_url to users if missing
  try { db.run('ALTER TABLE users ADD COLUMN avatar_url TEXT'); } catch(e) {}

  dbWrapper.init(db);
  saveDb();
  seedDatabase();
}

function seedDatabase() {
  const bcrypt = require('bcryptjs');

  // Check if seeded (sql.js exec returns [{columns, values}])
  const result = db.exec('SELECT COUNT(*) as count FROM categories');
  if (result.length > 0 && result[0].values[0][0] > 0) {
    console.log('数据库已有种子数据，跳过种子化');
    return;
  }

  console.log('开始填充种子数据...');
  const hashedPassword = bcrypt.hashSync('123456', 10);

  // Test users
  db.run('INSERT INTO users (name, email, password, role, avatar) VALUES (?, ?, ?, ?, ?)',
    ['测试用户', 'test@test.com', hashedPassword, 'user', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200']);
  db.run('INSERT INTO users (name, email, password, role, avatar) VALUES (?, ?, ?, ?, ?)',
    ['管理员', 'admin@test.com', hashedPassword, 'admin', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200']);

  // Categories
  const cats = [
    ['珠宝首饰', 'jewelry', 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400', '精选钻石珍珠宝石'],
    ['奢华腕表', 'watches', 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=400', '瑞士工艺经典时尚'],
    ['时尚手袋', 'bags', 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400', '顶级皮具优雅随行'],
    ['香水香氛', 'perfumes', 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=400', '法国调香奢华芬芳'],
    ['精品鞋履', 'shoes', 'https://images.unsplash.com/photo-1543163521-1bf539c0165a?w=400', '意大利手工步履生辉'],
    ['时尚配饰', 'accessories', 'https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?w=400', '丝巾墨镜精致配饰']
  ];
  cats.forEach(c => db.run('INSERT INTO categories (name, slug, image, description) VALUES (?, ?, ?, ?)', c));

  // Products data
  const allProducts = [
    // Jewelry (cat 1)
    [1,'璀璨星空 钻石项链',28800,35800,'18K白金镶嵌0.5克拉天然钻石，精湛切工，璀璨夺目。简约星形设计，适合各种场合佩戴。',
     'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600',
     'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600,https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600,https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=600',
     '{"材质":"18K白金","主石":"天然钻石0.5ct","链长":"45cm","工艺":"微镶","产地":"意大利"}',15,'hot'],
    [1,'南海珍珠 优雅耳坠',6800,8800,'精选8-9mm天然南海珍珠，搭配18K金镶钻耳扣，优雅气质尽显。',
     'https://images.unsplash.com/photo-1629224316810-9d8805b95e76?w=600',
     'https://images.unsplash.com/photo-1629224316810-9d8805b95e76?w=600,https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600',
     '{"材质":"18K金","珍珠":"南洋珍珠8-9mm","款式":"耳钩式","产地":"日本"}',30,'new'],
    [1,'翡翠如意 吊坠挂件',15800,null,'天然A货翡翠，冰糯种飘绿，精雕如意造型，寓意吉祥如意。附权威鉴定证书。',
     'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600',
     'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600,https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600',
     '{"材质":"天然翡翠A货","种水":"冰糯种","尺寸":"35x22x8mm","证书":"国检NGTC","产地":"缅甸"}',8,'sale'],
    [1,'玫瑰金 永恒戒指',4800,6500,'18K玫瑰金打造，戒圈点缀碎钻，简约时尚，可作为婚戒或日常佩戴。',
     'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600',
     'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600,https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=600',
     '{"材质":"18K玫瑰金","钻石":"碎钻0.08ct","圈号":"可调节","产地":"法国"}',40,null],
    [1,'蓝宝石 水滴手链',12800,16800,'天然斯里兰卡蓝宝石，水滴切割，搭配18K白金链身，腕间一抹深邃蓝。',
     'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=600',
     'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=600,https://images.unsplash.com/photo-1629224316810-9d8805b95e76?w=600',
     '{"材质":"18K白金","主石":"蓝宝石2.5ct","链长":"18cm","产地":"斯里兰卡"}',12,'hot'],
    [1,'满天星 碎钻锁骨链',3200,null,'925银镀铂金，精致碎钻点缀，轻盈锁骨链，日系简约风格，日常百搭。',
     'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600',
     'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600,https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600',
     '{"材质":"925银镀铂金","钻石":"碎钻","链长":"40cm+5cm延长","产地":"日本"}',60,'new'],
    // Watches (cat 2)
    [2,'瑞士经典 自动机械腕表',35800,42800,'ETA 2824-2自动上链机芯，蓝宝石水晶镜面，316L精钢表壳。',
     'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=600',
     'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=600,https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?w=600',
     '{"机芯":"ETA 2824-2","表壳":"316L精钢","表镜":"蓝宝石水晶","防水":"50m","表径":"40mm","产地":"瑞士"}',20,'hot'],
    [2,'月相盈亏 典藏腕表',56800,null,'复杂功能腕表，月相显示、日期、星期三历，鳄鱼皮表带。',
     'https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?w=600',
     'https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?w=600,https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=600',
     '{"机芯":"瑞士自动机械","表壳":"18K玫瑰金","表带":"鳄鱼皮","功能":"月相/日历/星期","表径":"42mm","产地":"瑞士"}',5,'sale'],
    [2,'极简主义 超薄石英表',2800,3600,'厚度仅6.8mm超薄设计，日本进口石英机芯，米兰尼斯钢带。',
     'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600',
     'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600,https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=600',
     '{"机芯":"日本石英","表壳":"316L精钢","厚度":"6.8mm","防水":"30m","表径":"38mm","产地":"日本"}',50,'new'],
    [2,'潜水勇士 运动腕表',12800,15800,'300米专业潜水表，单向旋转表圈，夜光指针，旋入式表冠。',
     'https://images.unsplash.com/photo-1548171915-b5b627cbfba9?w=600',
     'https://images.unsplash.com/photo-1548171915-b5b627cbfba9?w=600,https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?w=600',
     '{"机芯":"自动机械","防水":"300m","表壳":"钛合金","表镜":"蓝宝石","表径":"44mm","产地":"瑞士"}',18,'hot'],
    [2,'复古计时 飞行员腕表',8800,null,'经典飞行员设计，大表冠，棕色小牛皮表带，多功能计时。',
     'https://images.unsplash.com/photo-1548171915-b5b627cbfba9?w=600',
     'https://images.unsplash.com/photo-1548171915-b5b627cbfba9?w=600,https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600',
     '{"机芯":"自动机械","表壳":"PVD镀黑","表带":"小牛皮","功能":"计时码表","表径":"43mm","产地":"德国"}',25,null],
    [2,'优雅佳人 陶瓷女表',16800,19800,'高科技陶瓷表壳，珍珠母贝表盘，钻石时标，优雅女性专属。',
     'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600',
     'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600,https://images.unsplash.com/photo-1548171915-b5b627cbfba9?w=600',
     '{"机芯":"石英","表壳":"高科技陶瓷","表盘":"珍珠母贝","表径":"34mm","防水":"30m","产地":"瑞士"}',15,'new'],
    // Bags (cat 3)
    [3,'经典菱格纹 链条包',15800,18800,'小羊皮材质，经典菱格纹绗缝，金属链条肩带，百搭之选。',
     'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600',
     'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600,https://images.unsplash.com/photo-1591561954557-26941169b49e?w=600',
     '{"材质":"小羊皮","尺寸":"22x14x7cm","肩带":"金属链条","五金":"金色","产地":"法国"}',20,'hot'],
    [3,'托特包 大容量通勤',6800,null,'粒面牛皮，大容量托特包，可装13寸笔记本，职场女性理想选择。',
     'https://images.unsplash.com/photo-1591561954557-26941169b49e?w=600',
     'https://images.unsplash.com/photo-1591561954557-26941169b49e?w=600,https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600',
     '{"材质":"粒面牛皮","尺寸":"38x28x14cm","内部":"拉链袋+插袋","承重":"5kg","产地":"意大利"}',35,null],
    [3,'迷你马鞍包 复古风',4800,5800,'头层牛皮，复古马鞍造型，翻盖磁扣，小巧精致，约会出街必备。',
     'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=600',
     'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=600,https://images.unsplash.com/photo-1591561954557-26941169b49e?w=600',
     '{"材质":"头层牛皮","尺寸":"18x15x6cm","肩带":"可调节","五金":"古铜","产地":"意大利"}',40,'sale'],
    [3,'双肩背包 轻奢旅行',3200,4200,'尼龙搭配牛皮饰边，轻便耐磨，多隔层设计。',
     'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600',
     'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600,https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600',
     '{"材质":"尼龙+牛皮","尺寸":"30x38x14cm","容量":"18L","隔层":"电脑隔层+多口袋","产地":"意大利"}',30,'new'],
    [3,'鳄鱼纹 晚宴手拿包',8800,null,'压花鳄鱼纹牛皮，精致晚宴手拿包，可拆卸链条。',
     'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=600',
     'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=600,https://images.unsplash.com/photo-1591561954557-26941169b49e?w=600',
     '{"材质":"压花牛皮","尺寸":"24x12x4cm","五金":"金色","特点":"可拆卸链条","产地":"法国"}',12,'hot'],
    [3,'水桶包 抽绳束口',5600,6800,'荔枝纹牛皮，水桶造型，抽绳束口，内里绒布，随性优雅。',
     'https://images.unsplash.com/photo-1591561954557-26941169b49e?w=600',
     'https://images.unsplash.com/photo-1591561954557-26941169b49e?w=600,https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600',
     '{"材质":"荔枝纹牛皮","尺寸":"20x22x12cm","内里":"绒布","五金":"银色","产地":"意大利"}',22,'sale'],
    // Perfumes (cat 4)
    [4,'玫瑰晨露 女士淡香精',1280,1680,'前调:佛手柑/中调:大马士革玫瑰/尾调:白麝香。清晨玫瑰园的芬芳。',
     'https://images.unsplash.com/photo-1541643600914-78b084683601?w=600',
     'https://images.unsplash.com/photo-1541643600914-78b084683601?w=600,https://images.unsplash.com/photo-1563170351-be82bc888aa4?w=600',
     '{"香调":"花香调","浓度":"EDP","容量":"50ml","留香":"6-8小时","产地":"法国"}',80,'hot'],
    [4,'木质琥珀 男士淡香水',980,null,'前调:柑橘/中调:雪松/尾调:琥珀。沉稳木质香调。',
     'https://images.unsplash.com/photo-1563170351-be82bc888aa4?w=600',
     'https://images.unsplash.com/photo-1563170351-be82bc888aa4?w=600,https://images.unsplash.com/photo-1541643600914-78b084683601?w=600',
     '{"香调":"木质调","浓度":"EDT","容量":"100ml","留香":"4-6小时","产地":"法国"}',60,null],
    [4,'茉莉花语 清新淡香',680,880,'前调:柠檬/中调:茉莉/尾调:檀香。清新茉莉花香。',
     'https://images.unsplash.com/photo-1588405748880-12d1d2a59f75?w=600',
     'https://images.unsplash.com/photo-1588405748880-12d1d2a59f75?w=600,https://images.unsplash.com/photo-1541643600914-78b084683601?w=600',
     '{"香调":"花香调","浓度":"EDT","容量":"75ml","留香":"3-5小时","产地":"法国"}',100,'sale'],
    [4,'海洋之心 中性香氛',1580,1980,'前调:海盐/中调:薰衣草/尾调:龙涎香。清新海洋气息。',
     'https://images.unsplash.com/photo-1588405748880-12d1d2a59f75?w=600',
     'https://images.unsplash.com/photo-1588405748880-12d1d2a59f75?w=600,https://images.unsplash.com/photo-1563170351-be82bc888aa4?w=600',
     '{"香调":"海洋调","浓度":"EDP","容量":"100ml","留香":"6-8小时","产地":"法国"}',45,'new'],
    [4,'东方沉香 奢享典藏',3880,null,'前调:藏红花/中调:沉香/尾调:皮革。中东沉香基调。',
     'https://images.unsplash.com/photo-1541643600914-78b084683601?w=600',
     'https://images.unsplash.com/photo-1541643600914-78b084683601?w=600,https://images.unsplash.com/photo-1563170351-be82bc888aa4?w=600',
     '{"香调":"东方调","浓度":"Parfum","容量":"30ml","留香":"12小时+","产地":"阿联酋"}',10,'hot'],
    [4,'柑橘夏日 限定淡香',520,720,'前调:蜜橘/中调:橙花/尾调:雪松。阳光活力的柑橘香。',
     'https://images.unsplash.com/photo-1563170351-be82bc888aa4?w=600',
     'https://images.unsplash.com/photo-1563170351-be82bc888aa4?w=600,https://images.unsplash.com/photo-1588405748880-12d1d2a59f75?w=600',
     '{"香调":"柑橘调","浓度":"EDT","容量":"50ml","留香":"3-4小时","产地":"法国"}',75,'new'],
    // Shoes (cat 5)
    [5,'经典红底 细高跟鞋',6800,8800,'漆皮材质，标志性红底，10cm细跟，优雅尖头。',
     'https://images.unsplash.com/photo-1543163521-1bf539c0165a?w=600',
     'https://images.unsplash.com/photo-1543163521-1bf539c0165a?w=600,https://images.unsplash.com/photo-1515347619252-60a6bf4fffce?w=600',
     '{"材质":"漆皮","跟高":"10cm","鞋型":"尖头","内里":"真皮","产地":"意大利"}',25,'hot'],
    [5,'意式手工 乐福鞋',3800,null,'小牛皮手工缝制，经典马衔扣装饰，舒适平底。',
     'https://images.unsplash.com/photo-1515347619252-60a6bf4fffce?w=600',
     'https://images.unsplash.com/photo-1515347619252-60a6bf4fffce?w=600,https://images.unsplash.com/photo-1543163521-1bf539c0165a?w=600',
     '{"材质":"小牛皮","跟高":"2cm","鞋型":"圆头","工艺":"手工缝制","产地":"意大利"}',30,null],
    [5,'轻弹科技 运动鞋',2200,2800,'飞织鞋面，轻弹中底科技，橡胶外底，日常穿搭与轻运动结合。',
     'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600',
     'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600,https://images.unsplash.com/photo-1515347619252-60a6bf4fffce?w=600',
     '{"材质":"飞织鞋面","中底":"轻弹EVA","外底":"橡胶","重量":"260g","产地":"越南"}',80,'new'],
    [5,'铆钉装饰 机车靴',4800,5800,'头层牛皮，铆钉装饰，橡胶厚底，侧拉链设计。',
     'https://images.unsplash.com/photo-1515347619252-60a6bf4fffce?w=600',
     'https://images.unsplash.com/photo-1515347619252-60a6bf4fffce?w=600,https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600',
     '{"材质":"头层牛皮","跟高":"4cm","筒高":"15cm","闭合":"侧拉链","产地":"意大利"}',18,'sale'],
    [5,'优雅细带 凉鞋',1800,null,'羊皮细带缠绕设计，方跟5cm，优雅露趾，夏日必备。',
     'https://images.unsplash.com/photo-1543163521-1bf539c0165a?w=600',
     'https://images.unsplash.com/photo-1543163521-1bf539c0165a?w=600,https://images.unsplash.com/photo-1515347619252-60a6bf4fffce?w=600',
     '{"材质":"羊皮","跟高":"5cm","鞋型":"露趾","扣合":"踝带扣","产地":"西班牙"}',35,'new'],
    [5,'复古方头 切尔西靴',3600,4500,'意大利小牛皮，松紧侧边，方头设计，经典切尔西靴型。',
     'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600',
     'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600,https://images.unsplash.com/photo-1543163521-1bf539c0165a?w=600',
     '{"材质":"意大利小牛皮","跟高":"3cm","筒高":"13cm","鞋型":"方头","产地":"意大利"}',20,null],
    // Accessories (cat 6)
    [6,'真丝方巾 艺术印花',1280,1680,'100%桑蚕丝，90x90cm，数码印花艺术图案。',
     'https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?w=600',
     'https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?w=600,https://images.unsplash.com/photo-1584030373081-f37b7bb4fa33?w=600',
     '{"材质":"100%桑蚕丝","尺寸":"90x90cm","工艺":"数码印花","产地":"中国"}',50,'hot'],
    [6,'复古圆框 太阳镜',1680,null,'金属圆框，偏光镜片，UV400防护，复古文艺范。',
     'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600',
     'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600,https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?w=600',
     '{"镜框":"金属","镜片":"偏光","防护":"UV400","重量":"28g","产地":"意大利"}',40,'new'],
    [6,'意大利手工 皮带',2200,2800,'头层牛皮，亮面金属扣头，经典针扣设计。',
     'https://images.unsplash.com/photo-1584030373081-f37b7bb4fa33?w=600',
     'https://images.unsplash.com/photo-1584030373081-f37b7bb4fa33?w=600,https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?w=600',
     '{"材质":"头层牛皮","扣头":"金属亮面","宽度":"3.5cm","长度":"可裁剪","产地":"意大利"}',35,'sale'],
    [6,'羊绒围巾 经典格纹',980,1280,'100%羊绒，经典格纹图案，柔软亲肤，秋冬温暖相伴。',
     'https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?w=600',
     'https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?w=600,https://images.unsplash.com/photo-1584030373081-f37b7bb4fa33?w=600',
     '{"材质":"100%羊绒","尺寸":"180x30cm","图案":"格纹","产地":"苏格兰"}',55,null],
    [6,'精致胸针 水晶蜻蜓',880,null,'合金镀金底，镶嵌施华洛世奇水晶，蜻蜓造型。',
     'https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?w=600',
     'https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?w=600,https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600',
     '{"材质":"合金镀金","镶嵌":"施华洛世奇水晶","尺寸":"5x4cm","扣针":"安全扣","产地":"奥地利"}',30,'new'],
    [6,'编织草帽 度假风情',580,780,'天然拉菲草编织，宽檐设计，可调节内带，夏日海边度假。',
     'https://images.unsplash.com/photo-1584030373081-f37b7bb4fa33?w=600',
     'https://images.unsplash.com/photo-1584030373081-f37b7bb4fa33?w=600,https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600',
     '{"材质":"拉菲草","帽檐":"12cm","内带":"可调节","头围":"56-58cm","产地":"厄瓜多尔"}',45,'sale'],
  ];

  const stmt = db.prepare(
    'INSERT INTO products (category_id, name, price, original_price, description, image, images, specs, stock, badge) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  allProducts.forEach(p => stmt.run(p));
  stmt.free();

  // Seed banners
  db.run('INSERT INTO banners (image, title, subtitle, link, sort_order) VALUES (?, ?, ?, ?, ?)',
    ['https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200', '夏季臻选', '全场低至5折', '/products?sort=price_asc', 1]);
  db.run('INSERT INTO banners (image, title, subtitle, link, sort_order) VALUES (?, ?, ?, ?, ?)',
    ['https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1200', '新品首发', '2026 春夏系列', '/products?badge=new', 2]);
  db.run('INSERT INTO banners (image, title, subtitle, link, sort_order) VALUES (?, ?, ?, ?, ?)',
    ['https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200', '腕表特辑', '瑞士工艺 经典传承', '/products?category=watches', 3]);

  // Seed coupons
  db.run('INSERT INTO coupons (code, type, value, min_order, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)',
    ['WELCOME10', 'fixed', 200, 500, '2026-01-01', '2027-12-31']);
  db.run('INSERT INTO coupons (code, type, value, min_order, max_discount, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ['SUMMER20', 'percent', 20, 2000, 1000, '2026-01-01', '2027-12-31']);
  db.run('INSERT INTO coupons (code, type, value, min_order, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)',
    ['VIP500', 'fixed', 500, 5000, '2026-01-01', '2027-12-31']);

  // Give welcome coupon to test user
  db.run('INSERT INTO user_coupons (user_id, coupon_id) VALUES (1, 1)');
  db.run('INSERT INTO user_coupons (user_id, coupon_id) VALUES (1, 2)');

  saveDb();
  console.log(`种子数据填充完成！6个分类，${allProducts.length}个产品，2个用户，3个Banner，3张优惠券。`);
}

module.exports = { getDb, saveDb, initDatabase, seedDatabase };

// Compatibility layer: make sql.js act like better-sqlite3
// sql.js prepare() returns arrays, we wrap to return objects

function rowToObject(columns, values) {
  if (!values) return undefined;
  const obj = {};
  columns.forEach((col, i) => { obj[col] = values[i]; });
  return obj;
}

function rowsToObjects(columns, valuesArray) {
  return valuesArray.map(values => rowToObject(columns, values));
}

class StatementWrapper {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
    this.stmt = db.prepare(sql);
  }

  run(...params) {
    this.stmt.run(params);
    // After run, re-prepare (sql.js stmt can't be reused)
    this.stmt.free();
    this.stmt = this.db.prepare(this.sql);
    return {
      lastInsertRowid: this.db.exec("SELECT last_insert_rowid()")[0].values[0][0],
      changes: this.db.getRowsModified()
    };
  }

  get(...params) {
    this.stmt.bind(params);
    let result;
    if (this.stmt.step()) {
      const columns = this.stmt.getColumnNames();
      const values = this.stmt.get();
      result = rowToObject(columns, values);
    }
    this.stmt.free();
    this.stmt = this.db.prepare(this.sql);
    return result;
  }

  all(...params) {
    const results = [];
    this.stmt.bind(params);
    const columns = this.stmt.getColumnNames();
    while (this.stmt.step()) {
      const values = this.stmt.get();
      results.push(rowToObject(columns, values));
    }
    this.stmt.free();
    this.stmt = this.db.prepare(this.sql);
    return results;
  }

  free() {
    this.stmt.free();
  }
}

// Wrap the db object with better-sqlite3-like API
const dbWrapper = {
  _rawDb: null,

  init(rawDb) {
    this._rawDb = rawDb;
  },

  prepare(sql) {
    return new StatementWrapper(this._rawDb, sql);
  },

  exec(sql) {
    this._rawDb.run(sql);
  },

  transaction(fn) {
    return (...args) => {
      this._rawDb.run('BEGIN');
      try {
        const result = fn(...args);
        this._rawDb.run('COMMIT');
        saveDb();
        return result;
      } catch (e) {
        this._rawDb.run('ROLLBACK');
        throw e;
      }
    };
  },

  run(sql, params) {
    this._rawDb.run(sql, params);
    saveDb();
  }
};

module.exports = { getDb, saveDb, initDatabase, seedDatabase, db: dbWrapper };
