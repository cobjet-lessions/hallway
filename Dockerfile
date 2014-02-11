# Docker Base Nodejs

FROM dockerfile/nodejs

MAINTAINER Simon Murtha Smith <simon.smith@appcelerator.com>

# Bundle app source
ADD . /app

# Install app dependencies
RUN cd /app; npm install --production

EXPOSE  8080
WORKDIR /app
ENV NODE_PATH lib
CMD ["./hallway"]
