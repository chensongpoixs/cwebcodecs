class WebGLRenderer {
  #canvas = null;
  #ctx = null;

  static vertexShaderSource = `
    attribute vec2 xy;

    varying   vec2 uv;

    void main(void) {
     
      // Map vertex coordinates (-1 to +1) to UV coordinates (0 to 1).
      // UV coordinates are Y-flipped relative to vertex coordinates.
	 // uv = xy * 0.5 + 0.5;
	   gl_Position = vec4(xy, 0.0, 1.0);
      uv = vec2((1.0 + xy.x) / 2.0, (1.0 - xy.y) / 2.0)  ;
	 // uv *= 0.5 + 0.5;
    }
  `;

  static fragmentShaderSource = `
    precision mediump float;
	
	varying   vec2 uv;

    uniform sampler2D videoTexture;
	// 函数用于调整颜色
  vec3 enhanceColor(vec3 color, float saturation, float contrast, float brightness)
  {
    // 饱和度调整
    vec3 grey = vec3(dot(vec3(0.2126, 0.7152, 0.0722), color));
    color = mix(grey, color, saturation);

    // 对比度调整
    color = (color - 0.5) * contrast + 0.5;

    // 亮度调整
    color += brightness;

    return color;
  }

    void main(void) {
		 
		vec3 color = texture2D(videoTexture, uv).rgb;
		// 1、超分辨率
		//vec2 videoSize = vec2(1920.0, 1080.0); // 视频的原始大小
	//	vec2 newSize = vec2(3840.0, 2160.0); // 超分辨率后的大小
	//	vec2 uvScaled = uv * newSize / videoSize;
	//	color = texture2D(videoTexture, uvScaled).rgb;
		
    // 2、锐化算法示例
    //vec3 sharpenedColor = color * 3.0 - texture2D(videoTexture, uv - vec2(0.001, 0.001)).rgb - texture2D(videoTexture, uv + vec2(0.001, 0.001)).rgb;
	vec2 texelSize = 1.0 / vec2(1920.0, 1080.0); // 根据视频分辨率调整

   // vec3 color = texture2D(videoTexture, uv).rgb;
    vec3 sum = vec3(0.0);

    // Sobel算子示例
    sum += texture2D(videoTexture, uv + texelSize * vec2(-1, -1)).rgb * -1.0;
    sum += texture2D(videoTexture, uv + texelSize * vec2(0, -1)).rgb * -2.0;
    sum += texture2D(videoTexture, uv + texelSize * vec2(1, -1)).rgb * -1.0;
    sum += texture2D(videoTexture, uv + texelSize * vec2(-1, 0)).rgb * -2.0;
    sum += texture2D(videoTexture, uv).rgb * 4.0; // 中心像素权重增加
    sum += texture2D(videoTexture, uv + texelSize * vec2(1, 0)).rgb * -2.0;
    sum += texture2D(videoTexture, uv + texelSize * vec2(-1, 1)).rgb * -1.0;
    sum += texture2D(videoTexture, uv + texelSize * vec2(0, 1)).rgb * -2.0;
    sum += texture2D(videoTexture, uv + texelSize * vec2(1, 1)).rgb * -1.0;

    // 调整锐化强度
    float intensity = 0.00070001;
    color += sum * intensity;
	// 3、噪声去除示例
	//vec2 noiseSize = vec2(1.0 / 1920.0, 1.0 / 1080.0); // 噪声的大小，根据视频分辨率调整 
    //vec3 noise = texture2D(videoTexture, uv + noiseSize * vec2(1.0, 0.0)).rgb;
    //color = mix(color, noise, 1.0); // 调整这个值以控制去噪的强度
	// 4、运动补偿示例
   // vec3 motionCompensatedColor = color + texture2D(videoTexture, uv + vec2(0.01, 0.0)).rgb;

	 // 5、 调整颜色，可以根据需要调整参数
    color = enhanceColor(color, 1.18, 1.15, 0.0001);

    
	
	////////////////////////////////////////
	// 6、 HDR 
	//color = pow(coor, vec(1.1));
	//color = color / (color + vec3(1.0));
    //  gl_FragColor = texture2D(videoTexture, uv);
	 //gl_FragColor.rgb = pow(color, vec3(1.0)); // Gamma校正，可以根据需要调整指数
	  //gl_FragColor.rgb = gl_FragColor.rgb / (gl_FragColor.rgb + vec3(1.0)); // 进行Tone Mapping
	 gl_FragColor = vec4(color , 1.0);
    }
  `;

  constructor(type, canvas) {
    this.#canvas = canvas;
    const gl = this.#ctx = canvas.getContext(type);

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, WebGLRenderer.vertexShaderSource);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      throw gl.getShaderInfoLog(vertexShader);
    }

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, WebGLRenderer.fragmentShaderSource);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      throw gl.getShaderInfoLog(fragmentShader);
    }

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram (shaderProgram );
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
      throw gl.getProgramInfoLog(shaderProgram);
    }
    gl.useProgram(shaderProgram);
	const xyLocation = gl.getAttribLocation(shaderProgram, "xy");
	//const videoTextureUniform = gl.getUniformLocation(shaderProgram, 'videoTexture');
    // Vertex coordinates, clockwise from bottom-left.
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
	-1.0, -1.0,
      -1.0, +1.0,
      +1.0, +1.0,
      +1.0, -1.0
    ]), gl.STATIC_DRAW);

    
    gl.vertexAttribPointer(xyLocation, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(xyLocation);

    // Create one texture to upload frames to.
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	// 将视频纹理绑定到uniform
	//gl.uniform1i(videoTextureUniform, 0);
  }

  draw(frame) {
    this.#canvas.width = frame.displayWidth  ;
    this.#canvas.height = frame.displayHeight  ;

    const gl = this.#ctx;
  
    // Upload the frame.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame);
    frame.close();

    // Configure and clear the drawing area.
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(1.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Draw the frame.
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
  }
};
