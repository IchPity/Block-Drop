package gui;

import javax.imageio.ImageIO;

import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;

public class IL {
    public static BufferedImage[] figurenW = new BufferedImage[6];
    public static BufferedImage[] figurenB = new BufferedImage[6];

    public static void load(){
        try {
            for (int i = 0; i < 6; i++) {
                figurenW[i] = ImageIO.read(new File("rsc/"+(i+1)+"w.png"));
                figurenB[i] = ImageIO.read(new File("rsc/"+(i+1)+"b.png"));
            }
        } catch (IOException e) {
            e.printStackTrace();
        }

    }
}
