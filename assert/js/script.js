// 赛博朋克风格Github个人主页JavaScript

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
  // 主题切换功能
  const themeToggle = document.getElementById('theme-toggle');
  const themeIcon = themeToggle.querySelector('i');
  
  // 检查用户之前的主题偏好
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
  }
  
  // 主题切换事件
  themeToggle.addEventListener('click', function() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    // 更新主题
    document.documentElement.setAttribute('data-theme', newTheme);
    
    // 保存主题偏好
    localStorage.setItem('theme', newTheme);
    
    // 更新图标
    updateThemeIcon(newTheme);
    
    // 添加切换动画效果
    themeToggle.style.transform = 'rotate(180deg)';
    setTimeout(() => {
      themeToggle.style.transform = 'rotate(0)';
    }, 300);
  });
  
  // 更新主题图标
  function updateThemeIcon(theme) {
    if (theme === 'light') {
      themeIcon.classList.remove('fa-moon');
      themeIcon.classList.add('fa-sun');
      themeToggle.title = '切换到深色主题';
    } else {
      themeIcon.classList.remove('fa-sun');
      themeIcon.classList.add('fa-moon');
      themeToggle.title = '切换到浅色主题';
    }
  }

  // 加载动画
  setTimeout(function() {
    const loading = document.querySelector('.loading');
    if (loading) {
      loading.classList.add('hidden');
    }
  }, 1500);

  // 回到顶部按钮
  const backToTopBtn = document.createElement('button');
  backToTopBtn.className = 'back-to-top';
  backToTopBtn.innerHTML = '<i class="fa fa-arrow-up"></i>';
  document.body.appendChild(backToTopBtn);

  // 监听滚动事件
  window.addEventListener('scroll', function() {
    if (window.pageYOffset > 300) {
      backToTopBtn.classList.add('visible');
    } else {
      backToTopBtn.classList.remove('visible');
    }
  });

  // 回到顶部功能
  backToTopBtn.addEventListener('click', function() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });

  // 导航链接点击效果
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      
      // 添加点击效果
      this.style.transform = 'scale(0.95)';
      setTimeout(() => {
        this.style.transform = '';
      }, 150);
      
      // 滚动到对应部分
      const targetId = this.getAttribute('href');
      const targetElement = document.querySelector(targetId);
      
      if (targetElement) {
        window.scrollTo({
          top: targetElement.offsetTop - 20,
          behavior: 'smooth'
        });
      }
    });
  });

  // 项目卡片悬停效果增强
  const projectCards = document.querySelectorAll('.project-card');
  projectCards.forEach(card => {
    card.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-10px) rotateX(5deg)';
    });
    
    card.addEventListener('mouseleave', function() {
      this.style.transform = 'translateY(0) rotateX(0)';
    });
  });

  // 技能标签点击效果
  const skills = document.querySelectorAll('.skill');
  skills.forEach(skill => {
    skill.addEventListener('click', function() {
      // 随机改变颜色
      const colors = ['var(--neon-blue)', 'var(--neon-pink)', 'var(--neon-purple)', 'var(--neon-green)'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      
      this.style.borderColor = randomColor;
      this.style.color = randomColor;
      this.style.boxShadow = `0 0 15px ${randomColor}`;
      
      // 恢复原来的颜色
      setTimeout(() => {
        this.style.borderColor = '';
        this.style.color = '';
        this.style.boxShadow = '';
      }, 1000);
    });
  });

  // 添加粒子效果
  createParticles();

  // 添加打字机效果
  typeWriterEffect();
});

// 创建粒子效果
function createParticles() {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '-1';
  document.body.appendChild(container);
  
  const particleCount = 50;
  
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    
    // 随机大小
    const size = Math.random() * 3 + 1;
    
    // 随机位置
    const x = Math.random() * 100;
    const y = Math.random() * 100;
    
    // 随机颜色
    const colors = ['#00f3ff', '#ff00ff', '#9d00ff', '#39ff14'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    // 随机动画持续时间
    const duration = Math.random() * 20 + 10;
    
    // 设置样式
    particle.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      background-color: ${color};
      border-radius: 50%;
      left: ${x}%;
      top: ${y}%;
      box-shadow: 0 0 ${size * 2}px ${color};
      animation: float ${duration}s infinite linear;
      opacity: ${Math.random() * 0.5 + 0.3};
    `;
    
    container.appendChild(particle);
  }
  
  // 添加浮动动画
  const style = document.createElement('style');
  style.textContent = `
    @keyframes float {
      0% {
        transform: translateY(100vh) translateX(0);
      }
      100% {
        transform: translateY(-100px) translateX(100px);
      }
    }
  `;
  document.head.appendChild(style);
}

// 打字机效果
function typeWriterEffect() {
  const elements = document.querySelectorAll('.typewriter');
  
  elements.forEach(element => {
    const text = element.textContent;
    element.textContent = '';
    element.style.borderRight = '2px solid var(--neon-blue)';
    element.style.whiteSpace = 'nowrap';
    element.style.overflow = 'hidden';
    
    let i = 0;
    const typeSpeed = 100; // 打字速度（毫秒）
    
    function typeWriter() {
      if (i < text.length) {
        element.textContent += text.charAt(i);
        i++;
        setTimeout(typeWriter, typeSpeed);
      } else {
        // 打字完成后闪烁光标
        setInterval(() => {
          element.style.borderRight = element.style.borderRight === '2px solid var(--neon-blue)' 
            ? '2px solid transparent' 
            : '2px solid var(--neon-blue)';
        }, 500);
      }
    }
    
    // 延迟开始打字效果
    setTimeout(typeWriter, 1000);
  });
}

// 添加鼠标跟随效果
document.addEventListener('mousemove', function(e) {
  const cursor = document.querySelector('.cursor');
  
  if (!cursor) {
    const newCursor = document.createElement('div');
    newCursor.className = 'cursor';
    newCursor.style.cssText = `
      position: fixed;
      width: 20px;
      height: 20px;
      background-color: rgba(0, 243, 255, 0.5);
      border: 1px solid var(--neon-blue);
      border-radius: 50%;
      pointer-events: none;
      z-index: 9999;
      transform: translate(-50%, -50%);
      transition: width 0.2s, height 0.2s, background-color 0.2s;
      mix-blend-mode: difference;
    `;
    document.body.appendChild(newCursor);
  }
  
  const cursorElement = document.querySelector('.cursor');
  cursorElement.style.left = e.clientX + 'px';
  cursorElement.style.top = e.clientY + 'px';
  
  // 鼠标悬停在链接上时的效果
  const links = document.querySelectorAll('a, button');
  links.forEach(link => {
    link.addEventListener('mouseenter', function() {
      cursorElement.style.width = '40px';
      cursorElement.style.height = '40px';
      cursorElement.style.backgroundColor = 'rgba(255, 0, 255, 0.5)';
      cursorElement.style.borderColor = 'var(--neon-pink)';
    });
    
    link.addEventListener('mouseleave', function() {
      cursorElement.style.width = '20px';
      cursorElement.style.height = '20px';
      cursorElement.style.backgroundColor = 'rgba(0, 243, 255, 0.5)';
      cursorElement.style.borderColor = 'var(--neon-blue)';
    });
  });
});

// 禁用默认鼠标指针
document.body.style.cursor = 'none';

// 窗口大小改变时重新调整布局
window.addEventListener('resize', function() {
  // 重新计算时间线布局
  adjustTimeline();
});

// 调整时间线布局
function adjustTimeline() {
  const timelineItems = document.querySelectorAll('.timeline-item');
  
  if (window.innerWidth <= 768) {
    timelineItems.forEach(item => {
      item.classList.remove('left', 'right');
    });
  } else {
    timelineItems.forEach((item, index) => {
      if (index % 2 === 0) {
        item.classList.remove('right');
        item.classList.add('left');
      } else {
        item.classList.remove('left');
        item.classList.add('right');
      }
    });
  }
}

// 初始化时间线布局
adjustTimeline();