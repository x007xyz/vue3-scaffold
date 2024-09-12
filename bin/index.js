#!/usr/bin/env node

import inquirer from 'inquirer';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const uiFrameworkOptions = [
  { name: 'Ant Design Vue', value: 'antdv' },
  { name: 'Element Plus', value: 'element-plus' },
  { name: 'Arco Design Vue', value: 'arco' },
  { name: 'Naive UI', value: 'naive' },
];

async function scaffold() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: '请输入项目名称:',
      default: 'my-vue-project'
    },
    {
      type: 'checkbox',
      name: 'uiFrameworks',
      message: '请选择UI框架 (可多选):',
      choices: uiFrameworkOptions
    },
    {
      type: 'confirm',
      name: 'useRouter',
      message: '是否安装 Vue Router?',
      default: true
    },
    {
      type: 'confirm',
      name: 'useTailwind',
      message: '是否使用 Tailwind CSS?',
      default: false
    },
    {
      type: 'confirm',
      name: 'usePinia',
      message: '是否使用 Pinia 进行状态管理?',
      default: true
    },
    {
      type: 'confirm',
      name: 'usePiniaPersist',
      message: '是否使用 pinia-plugin-persistedstate 实现 Pinia 数据持久化?',
      default: false,
      when: (answers) => answers.usePinia
    },
    {
      type: 'list',
      name: 'packageManager',
      message: '请选择包管理器:',
      choices: ['npm', 'yarn', 'pnpm'],
      default: 'npm'
    }
  ]);

  const { projectName, uiFrameworks, useRouter, useTailwind, usePinia, usePiniaPersist, packageManager } = answers;

  console.log('创建项目...');
  if (packageManager === 'pnpm') {
    execSync(`pnpm create vite@latest ${projectName} --template vue-ts`, { stdio: 'inherit' });
  } else {
    execSync(`${packageManager} init vite@latest ${projectName} -- --template vue-ts`, { stdio: 'inherit' });
  }

  process.chdir(projectName);

  console.log('安装依赖...');
  execSync(`${packageManager} install`, { stdio: 'inherit' });

  console.log('初始化 Git 仓库...');
  execSync('git init', { stdio: 'inherit' });

  console.log('创建 .gitignore 文件...');
  const gitignoreContent = `
# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
`;
  fs.writeFileSync('.gitignore', gitignoreContent.trim());

  // 替换所有的 npm install 命令
  const install = (packages) => {
    const command = packageManager === 'yarn' ? 'add' : 'install';
    execSync(`${packageManager} ${command} ${packages}`, { stdio: 'inherit' });
  };

  if (useRouter) {
    console.log('安装 Vue Router...');
    install('vue-router@4');
  }

  if (useTailwind) {
    console.log('安装并配置 Tailwind CSS...');
    install('tailwindcss@latest postcss@latest autoprefixer@latest');
    execSync('npx tailwindcss init -p', { stdio: 'inherit' });
    
    const tailwindConfig = `
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
    `;
    fs.writeFileSync('tailwind.config.js', tailwindConfig);

    const indexCss = `
@tailwind base;
@tailwind components;
@tailwind utilities;
    `;
    fs.writeFileSync('src/index.css', indexCss);

    const mainPath = path.join(process.cwd(), 'src', 'main.ts');
    let mainContent = fs.readFileSync(mainPath, 'utf-8');
    mainContent = `import './index.css'\n${mainContent}`;
    fs.writeFileSync(mainPath, mainContent);
  }

  if (usePinia) {
    console.log('安装 Pinia...');
    install('pinia');
    if (usePiniaPersist) {
      console.log('安装 pinia-plugin-persistedstate...');
      install('pinia-plugin-persistedstate');
    }
  }

  console.log('添加ESLint配置...');
  execSync(`${packageManager === 'npm' ? 'npx' : packageManager + ' dlx'} @antfu/eslint-config@latest`, { stdio: 'inherit' });

  console.log('添加lint脚本到package.json...');
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }

  packageJson.scripts.lint = "eslint .";
  packageJson.scripts["lint:fix"] = "eslint . --fix";

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

  console.log('添加unplugin-auto-import...');
  install('unplugin-auto-import');
  fs.writeFileSync('src/auto-imports.d.ts', '');

  console.log('添加unplugin-vue-components...');
  install('unplugin-vue-components');
  fs.writeFileSync('src/components.d.ts', '');

  // 安装选中的UI框架
  for (const framework of uiFrameworks) {
    console.log(`安装 ${framework}...`);
    switch (framework) {
      case 'antdv':
        install('ant-design-vue');
        break;
      case 'element-plus':
        install('element-plus');
        break;
      case 'arco':
        install('@arco-design/web-vue');
        break;
      case 'naive':
        install('naive-ui');
        break;
    }
  }

  console.log('更新vite.config.ts...');
  const viteConfigPath = path.join(process.cwd(), 'vite.config.ts');
  let viteConfig = fs.readFileSync(viteConfigPath, 'utf-8');

  const resolvers = uiFrameworks.map(framework => {
    switch (framework) {
      case 'antdv': return 'AntDesignVueResolver';
      case 'element-plus': return 'ElementPlusResolver';
      case 'arco': return 'ArcoResolver';
      case 'naive': return 'NaiveUiResolver';
    }
  });

  viteConfig = viteConfig.replace(
    'export default defineConfig({',
    `import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ${resolvers.join(', ')} } from 'unplugin-vue-components/resolvers'

export default defineConfig({`
  );

  const imports = ['vue'];
  if (useRouter) imports.push('vue-router');
  if (usePinia) imports.push('pinia');

  viteConfig = viteConfig.replace(
    'plugins: [vue()],',
    `plugins: [
    vue(),
    AutoImport({
      imports: ${JSON.stringify(imports)},
      dts: 'src/auto-imports.d.ts',
    }),
    Components({
      resolvers: [${resolvers.map(resolver => `${resolver}()`).join(', ')}],
      dts: 'src/components.d.ts',
    }),
  ],`
  );
  fs.writeFileSync(viteConfigPath, viteConfig);

  if (useRouter) {
    console.log('配置 Vue Router...');
    const routerContent = `
import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/about',
    name: 'About',
    component: () => import('../views/About.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
    `;
    fs.mkdirSync('src/router', { recursive: true });
    fs.writeFileSync('src/router/index.ts', routerContent);

    fs.mkdirSync('src/views', { recursive: true });
    fs.writeFileSync('src/views/Home.vue', '<template><div>Home Page</div></template>');
    fs.writeFileSync('src/views/About.vue', '<template><div>About Page</div></template>');
  }

  if (usePinia) {
    console.log('配置 Pinia...');
    const storeContent = `
import { defineStore } from 'pinia'

export const useCounterStore = defineStore('counter', {
  state: () => ({ count: 0 }),
  actions: {
    increment() {
      this.count++
    }
  }
})
    `;
    fs.mkdirSync('src/stores', { recursive: true });
    fs.writeFileSync('src/stores/counter.ts', storeContent);
  }

  // 更新 main.ts
  const mainPath = path.join(process.cwd(), 'src', 'main.ts');
  let mainContent = fs.readFileSync(mainPath, 'utf-8');
  let appCreation = "const app = createApp(App)";

  if (useRouter) {
    mainContent = `import router from './router'\n${mainContent}`;
    appCreation += "\napp.use(router)";
  }

  if (usePinia) {
    mainContent = `import { createPinia } from 'pinia'\n${mainContent}`;
    if (usePiniaPersist) {
      mainContent = `import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'\n${mainContent}`;
    }
    appCreation += "\nconst pinia = createPinia()";
    if (usePiniaPersist) {
      appCreation += "\npinia.use(piniaPluginPersistedstate)";
    }
    appCreation += "\napp.use(pinia)";
  }

  mainContent = mainContent.replace(
    "createApp(App).mount('#app')",
    `${appCreation}\napp.mount('#app')`
  );
  fs.writeFileSync(mainPath, mainContent);

  console.log('执行 ESLint 修复...');
  try {
    execSync(`${packageManager} run lint:fix`, { stdio: 'inherit' });

    console.log('添加文件到 Git 并创建初始提交...');
    execSync('git add .', { stdio: 'inherit' });
    execSync('git commit -m "Initial commit"', { stdio: 'inherit' });
  } catch (error) {
    console.warn('ESLint 修复过程中出现警告或错误，请手动修复');
  }

  console.log('项目创建完成!');
}

scaffold().catch(console.error);